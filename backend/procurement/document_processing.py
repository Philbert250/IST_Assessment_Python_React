"""
Document processing module for proforma, PO generation, and receipt validation.
Uses OpenAI API for intelligent document extraction.
"""
import os
import json
import base64
import logging
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from openai import OpenAI
import google.generativeai as genai

logger = logging.getLogger(__name__)
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT


# Initialize AI clients
def get_openai_client():
    """Get OpenAI client instance."""
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def get_gemini_client():
    """Get Google Gemini client instance."""
    if not settings.GOOGLE_GEMINI_API_KEY:
        return None
    genai.configure(api_key=settings.GOOGLE_GEMINI_API_KEY)
    
    # Try to find an available model
    # List of models to try in order of preference
    # gemini-2.5-flash is the newest and fastest (free tier)
    model_names = [
        'models/gemini-2.5-flash',  # Newest, fastest, free tier
        'gemini-2.5-flash',
        'models/gemini-1.5-flash',
        'gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'gemini-1.5-pro',
        'models/gemini-pro',
        'gemini-pro',
    ]
    
    # Try each model name
    for model_name in model_names:
        try:
            model = genai.GenerativeModel(model_name)
            # Actually test the model with a simple call to verify it works
            try:
                test_response = model.generate_content("test")
                # If we get here, the model works
                print(f"✅ Using Gemini model: {model_name}")
                return model
            except Exception as test_error:
                # Model exists but might have issues, try next one
                print(f"⚠️ Model {model_name} failed test: {test_error}")
                continue
        except Exception as e:
            print(f"⚠️ Could not create model {model_name}: {e}")
            continue
    
    # If all fail, try to list available models
    try:
        print("🔍 Listing available Gemini models...")
        models = genai.list_models()
        for model in models:
            if 'generateContent' in model.supported_generation_methods:
                try:
                    test_model = genai.GenerativeModel(model.name)
                    test_response = test_model.generate_content("test")
                    print(f"✅ Found working model: {model.name}")
                    return test_model
                except:
                    continue
    except Exception as list_error:
        print(f"⚠️ Could not list models: {list_error}")
        pass
    
    # Return None if nothing works
    print("❌ No working Gemini models found, will use OCR fallback")
    return None


def extract_text_from_file(file_path_or_field) -> str:
    """
    Extract text from uploaded file (PDF, images).
    Uses multiple methods for better extraction.
    Handles both local files and Django file fields.
    """
    import pdfplumber
    from PIL import Image
    import pytesseract
    from django.core.files.storage import default_storage
    import tempfile
    import os
    
    text_content = ""
    temp_file_path = None
    file_obj = None
    
    try:
        # Handle Django file field - always use Django's storage system
        if hasattr(file_path_or_field, 'name'):
            # It's a Django FileField - use default_storage to access it
            # This works for both local storage and S3
            file_name = file_path_or_field.name
            logger.info(f"Opening file from storage: {file_name}")
            
            try:
                file_obj = None
                from django.conf import settings
                
                # IMPORTANT: Use the actual stored file name, not just .name
                # Django FileField stores the actual filename which may differ from upload name
                actual_file_name = file_path_or_field.name
                logger.info(f"FileField .name attribute: {actual_file_name}")
                
                # Strategy 1: Try .path attribute (works if file is on same machine)
                # This is the most reliable as it uses Django's internal path resolution
                if hasattr(file_path_or_field, 'path'):
                    try:
                        file_path = file_path_or_field.path
                        logger.info(f"Strategy 1: Checking .path: {file_path}")
                        if os.path.exists(file_path):
                            logger.info(f"✅ File found at .path: {file_path}")
                            file_obj = open(file_path, 'rb')
                        else:
                            logger.warning(f"❌ File not found at .path: {file_path}")
                            # Check if parent directory exists and list files
                            parent_dir = os.path.dirname(file_path)
                            if os.path.exists(parent_dir):
                                try:
                                    files = os.listdir(parent_dir)
                                    logger.info(f"Files in {parent_dir}: {files[:5]}")  # Show first 5
                                    # Try to find a file with similar name (case-insensitive)
                                    target_base = os.path.basename(file_path)
                                    for f in files:
                                        if f.lower() == target_base.lower():
                                            logger.info(f"Found case-insensitive match: {f}")
                                            matched_path = os.path.join(parent_dir, f)
                                            file_obj = open(matched_path, 'rb')
                                            logger.info(f"✅ Opened file using case-insensitive match: {matched_path}")
                                            break
                                except Exception as list_err:
                                    logger.warning(f"Could not list directory: {list_err}")
                    except Exception as path_error:
                        logger.warning(f"❌ .path access failed: {path_error}")
                
                # Strategy 2: Try constructing path from MEDIA_ROOT (for local storage)
                if file_obj is None:
                    if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT:
                        constructed_path = os.path.join(settings.MEDIA_ROOT, file_name)
                        logger.info(f"Strategy 2: Checking MEDIA_ROOT path: {constructed_path}")
                        logger.info(f"MEDIA_ROOT value: {settings.MEDIA_ROOT}")
                        logger.info(f"File name: {file_name}")
                        if os.path.exists(constructed_path):
                            logger.info(f"✅ File found at MEDIA_ROOT path: {constructed_path}")
                            file_obj = open(constructed_path, 'rb')
                        else:
                            logger.warning(f"❌ File not found at MEDIA_ROOT path: {constructed_path}")
                            # Check if directory exists
                            dir_path = os.path.dirname(constructed_path)
                            if os.path.exists(dir_path):
                                logger.info(f"Directory exists: {dir_path}")
                                try:
                                    files_in_dir = os.listdir(dir_path)
                                    logger.info(f"Files in directory ({len(files_in_dir)}): {files_in_dir[:10]}")  # Show first 10
                                except Exception as list_error:
                                    logger.warning(f"Could not list directory: {list_error}")
                            else:
                                logger.warning(f"Directory does not exist: {dir_path}")
                
                # Strategy 3: Try default_storage (works for all storage backends)
                if file_obj is None:
                    try:
                        logger.info(f"Strategy 3: Checking default_storage for: {file_name}")
                        if default_storage.exists(file_name):
                            logger.info(f"✅ File exists in storage, opening: {file_name}")
                            storage_file = default_storage.open(file_name, 'rb')
                            # Download to temp file for processing (pdfplumber/PIL need file-like objects)
                            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp:
                                tmp.write(storage_file.read())
                                temp_file_path = tmp.name
                            storage_file.close()
                            file_obj = open(temp_file_path, 'rb')
                            logger.info(f"File downloaded to temp file: {temp_file_path}")
                        else:
                            logger.warning(f"❌ File does not exist in storage: {file_name}")
                    except Exception as storage_error:
                        logger.warning(f"❌ Storage access failed: {storage_error}")
                
                # Strategy 4: If file not found locally, try downloading from URL
                # This works when file is on a different machine but accessible via HTTP
                if file_obj is None:
                    try:
                        import requests
                        # Construct the file URL
                        file_url = None
                        
                        # Try to get URL from FileField's .url attribute
                        if hasattr(file_path_or_field, 'url'):
                            file_url = file_path_or_field.url
                            logger.info(f"FileField .url attribute: {file_url}")
                            
                            # If URL is relative, make it absolute
                            if file_url and not file_url.startswith('http'):
                                base_url = getattr(settings, 'BACKEND_URL', 'https://procure-to-pay-backend-philbert.fly.dev')
                                # Ensure URL starts with /
                                if not file_url.startswith('/'):
                                    file_url = '/' + file_url
                                file_url = f"{base_url.rstrip('/')}{file_url}"
                                logger.info(f"Converted relative URL to absolute: {file_url}")
                        
                        # If no .url attribute, construct from MEDIA_URL
                        if not file_url:
                            media_url = getattr(settings, 'MEDIA_URL', '/media/')
                            base_url = getattr(settings, 'BACKEND_URL', 'https://procure-to-pay-backend-philbert.fly.dev')
                            if not media_url.startswith('http'):
                                if not media_url.startswith('/'):
                                    media_url = '/' + media_url
                                file_url = f"{base_url.rstrip('/')}{media_url.rstrip('/')}/{file_name}"
                            else:
                                file_url = f"{media_url.rstrip('/')}/{file_name}"
                        
                        logger.info(f"Strategy 4: Attempting to download file from URL: {file_url}")
                        response = requests.get(file_url, timeout=30)
                        if response.status_code == 200:
                            # Save to temp file
                            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp:
                                tmp.write(response.content)
                                temp_file_path = tmp.name
                            file_obj = open(temp_file_path, 'rb')
                            logger.info(f"✅ File downloaded from URL to temp file: {temp_file_path}")
                        else:
                            logger.warning(f"❌ Failed to download file from URL: HTTP {response.status_code}")
                    except ImportError:
                        logger.warning("❌ requests library not available, skipping URL download")
                    except Exception as url_error:
                        logger.warning(f"❌ URL download failed: {url_error}")
                
                # If all strategies failed, raise error with detailed info
                if file_obj is None:
                    error_details = []
                    if hasattr(settings, 'MEDIA_ROOT'):
                        error_details.append(f"MEDIA_ROOT={settings.MEDIA_ROOT}")
                    if hasattr(file_path_or_field, 'path'):
                        error_details.append(f".path={file_path_or_field.path}")
                    error_details.append(f"file_name={file_name}")
                    raise FileNotFoundError(
                        f"File not found using any method: {file_name}. "
                        f"Tried: .path, MEDIA_ROOT ({settings.MEDIA_ROOT if hasattr(settings, 'MEDIA_ROOT') else 'N/A'}), default_storage, and URL download. "
                        f"Details: {', '.join(error_details)}"
                    )
            except FileNotFoundError:
                # Re-raise FileNotFoundError as-is
                raise
            except Exception as storage_error:
                logger.error(f"Error opening file from storage: {storage_error}")
                # Fallback: try direct path if it exists
                if hasattr(file_path_or_field, 'path'):
                    try:
                        file_path = file_path_or_field.path
                        if os.path.exists(file_path):
                            logger.info(f"Using direct path fallback: {file_path}")
                            file_obj = open(file_path, 'rb')
                        else:
                            raise FileNotFoundError(f"File not found at {file_path} and storage access failed: {storage_error}")
                    except Exception as path_error:
                        logger.error(f"Direct path also failed: {path_error}")
                        raise FileNotFoundError(f"File not found in storage or at path: {file_name}. Storage error: {storage_error}, Path error: {path_error}")
                else:
                    raise FileNotFoundError(f"File not found in storage: {file_name}. Error: {storage_error}")
        elif hasattr(file_path_or_field, 'read'):
            # It's already a file-like object
            file_obj = file_path_or_field
            file_name = getattr(file_path_or_field, 'name', 'file')
        else:
            # It's a path string
            file_path = str(file_path_or_field)
            # Check if it's a full local path
            if os.path.exists(file_path):
                file_obj = open(file_path, 'rb')
                file_name = file_path
            else:
                # Might be S3 or other storage - download to temp file
                logger.info(f"Trying to open path as storage key: {file_path}")
                file_obj = default_storage.open(file_path, 'rb')
                # Create temp file for processing
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_path)[1]) as tmp:
                    tmp.write(file_obj.read())
                    temp_file_path = tmp.name
                file_obj.close()
                file_obj = open(temp_file_path, 'rb')
                file_name = file_path
        
        # Try PDF extraction first
        try:
            if file_name.lower().endswith('.pdf'):
                with pdfplumber.open(file_obj) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            text_content += text + "\n"
            else:
                # Try OCR for images
                image = Image.open(file_obj)
                text_content = pytesseract.image_to_string(image)
        finally:
            # Always close file
            if file_obj and hasattr(file_obj, 'close'):
                try:
                    file_obj.close()
                except:
                    pass
            
            # Clean up temp file if it was created
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temp file: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Error cleaning up temp file: {cleanup_error}")
        
        if not text_content or not text_content.strip():
            logger.warning(f"⚠️ Text extraction returned empty content for file: {file_name}")
            
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        # Clean up temp file on error
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        # Fallback: return empty string, OpenAI can still work with file if we send it
    
    return text_content


def encode_file_to_base64(file_path: str) -> str:
    """Encode file to base64 for OpenAI API."""
    with open(file_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def extract_basic_data_from_text(text: str) -> Dict[str, Any]:
    """
    Basic extraction using regex patterns (fallback when no AI available).
    Extracts basic information from document text.
    """
    import re
    
    extracted = {
        'vendor_name': '',
        'vendor_address': '',
        'vendor_email': '',
        'vendor_phone': '',
        'invoice_number': '',
        'invoice_date': '',
        'items': [],
        'subtotal': 0.0,
        'tax': 0.0,
        'total': 0.0,
        'payment_terms': '',
        'delivery_terms': '',
        'notes': ''
    }
    
    # Extract email
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    if emails:
        extracted['vendor_email'] = emails[0]
    
    # Extract phone
    phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}'
    phones = re.findall(phone_pattern, text)
    if phones:
        extracted['vendor_phone'] = phones[0]
    
    # Extract total amount (look for patterns like "Total: $500.00" or "TOTAL 500.00")
    total_patterns = [
        r'total[:\s]+[\$]?([\d,]+\.?\d*)',
        r'TOTAL[:\s]+[\$]?([\d,]+\.?\d*)',
        r'Amount[:\s]+[\$]?([\d,]+\.?\d*)'
    ]
    for pattern in total_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            try:
                total = float(matches[-1].replace(',', ''))
                extracted['total'] = total
                break
            except:
                pass
    
    # Extract invoice number
    invoice_patterns = [
        r'invoice[#\s:]+([A-Z0-9-]+)',
        r'INV[#\s:]+([A-Z0-9-]+)',
        r'Invoice\s+No[.:\s]+([A-Z0-9-]+)'
    ]
    for pattern in invoice_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            extracted['invoice_number'] = matches[0]
            break
    
    return extracted


def extract_proforma_data(file_path_or_field, file_name: str = None) -> Dict[str, Any]:
    """
    Extract data from proforma invoice using OpenAI.
    
    Returns:
        {
            'vendor_name': str,
            'vendor_address': str,
            'vendor_email': str,
            'vendor_phone': str,
            'invoice_number': str,
            'invoice_date': str,
            'items': [
                {
                    'description': str,
                    'quantity': float,
                    'unit_price': float,
                    'total_price': float
                }
            ],
            'subtotal': float,
            'tax': float,
            'total': float,
            'payment_terms': str,
            'delivery_terms': str,
            'notes': str
        }
    """
    try:
        # Extract text from file
        if file_name is None:
            file_name = getattr(file_path_or_field, 'name', 'file')
        text_content = extract_text_from_file(file_path_or_field)
        
        # Log text extraction result
        if not text_content or len(text_content.strip()) == 0:
            logger.warning(f"⚠️ Text extraction returned empty content for file: {file_name}")
            return {
                'error': 'Could not extract text from document. The file might be corrupted, empty, or in an unsupported format.',
                'vendor_name': '',
                'items': [],
                'total': 0.0,
                'extraction_failed': True
            }
        
        logger.info(f"✅ Extracted {len(text_content)} characters from {file_name}")
        
        # Prepare prompt for OpenAI
        prompt = """
        Extract the following information from this proforma invoice document:
        
        1. Vendor/Supplier Information:
           - Vendor name
           - Vendor address
           - Vendor email
           - Vendor phone
        
        2. Invoice Information:
           - Invoice number
           - Invoice date
        
        3. Line Items (for each item):
           - Description
           - Quantity
           - Unit price
           - Total price
        
        4. Financial Information:
           - Subtotal
           - Tax amount
           - Total amount
        
        5. Terms:
           - Payment terms
           - Delivery terms
           - Any notes
        
        Return the data as a JSON object with this structure:
        {
            "vendor_name": "...",
            "vendor_address": "...",
            "vendor_email": "...",
            "vendor_phone": "...",
            "invoice_number": "...",
            "invoice_date": "...",
            "items": [
                {
                    "description": "...",
                    "quantity": 1.0,
                    "unit_price": 0.0,
                    "total_price": 0.0
                }
            ],
            "subtotal": 0.0,
            "tax": 0.0,
            "total": 0.0,
            "payment_terms": "...",
            "delivery_terms": "...",
            "notes": "..."
        }
        
        Document text:
        """ + text_content[:4000]  # Limit text to avoid token limits
        
        # Call AI API (OpenAI, Gemini, or OCR fallback)
        ai_provider = getattr(settings, 'AI_PROVIDER', 'gemini')
        
        if ai_provider == 'openai':
            client = get_openai_client()
            if not client:
                return {
                    'error': 'OpenAI API key not configured',
                    'vendor_name': '',
                    'items': [],
                    'total': 0.0
                }
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting structured data from invoices and proforma documents. Always return valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            extracted_data = json.loads(response.choices[0].message.content)
            
        elif ai_provider == 'gemini':
            model = get_gemini_client()
            if not model:
                # Fallback to OCR if Gemini is not available
                print("Gemini model not available, falling back to OCR extraction")
                extracted_data = extract_basic_data_from_text(text_content)
            else:
                try:
                    # Gemini prompt
                    full_prompt = f"""You are an expert at extracting structured data from invoices and proforma documents. 
Extract the following information and return ONLY valid JSON (no markdown, no code blocks):

{prompt}

Return the data as a JSON object with this structure:
{{
    "vendor_name": "...",
    "vendor_address": "...",
    "vendor_email": "...",
    "vendor_phone": "...",
    "invoice_number": "...",
    "invoice_date": "...",
    "items": [
        {{
            "description": "...",
            "quantity": 1.0,
            "unit_price": 0.0,
            "total_price": 0.0
        }}
    ],
    "subtotal": 0.0,
    "tax": 0.0,
    "total": 0.0,
    "payment_terms": "...",
    "delivery_terms": "...",
    "notes": "..."
}}"""
                    
                    logger.info(f"🤖 Calling Gemini API for extraction...")
                    response = model.generate_content(full_prompt)
                    
                    # Check if response has content
                    if not response or not hasattr(response, 'text') or not response.text:
                        raise Exception("Gemini API returned empty response")
                    
                    # Extract JSON from response (Gemini sometimes wraps in markdown)
                    response_text = response.text.strip()
                    logger.info(f"📝 Gemini response length: {len(response_text)} characters")
                    
                    if '```json' in response_text:
                        response_text = response_text.split('```json')[1].split('```')[0].strip()
                    elif '```' in response_text:
                        response_text = response_text.split('```')[1].split('```')[0].strip()
                    
                    # Try to parse JSON
                    try:
                        extracted_data = json.loads(response_text)
                        logger.info(f"✅ Successfully parsed JSON from Gemini response")
                    except json.JSONDecodeError as json_error:
                        logger.error(f"❌ Failed to parse JSON from Gemini response: {json_error}")
                        logger.error(f"Response text (first 500 chars): {response_text[:500]}")
                        raise Exception(f"Invalid JSON response from Gemini: {json_error}")
                    
                except Exception as gemini_error:
                    error_msg = str(gemini_error)
                    logger.error(f"❌ Gemini API error: {error_msg}")
                    logger.error(f"Error type: {type(gemini_error).__name__}")
                    logger.error("   Falling back to OCR extraction...")
                    
                    # Fallback to OCR if Gemini fails
                    extracted_data = extract_basic_data_from_text(text_content)
                    # Add note about fallback
                    if 'error' not in extracted_data:
                        extracted_data['_extraction_method'] = 'ocr_fallback'
                        extracted_data['_ai_error'] = error_msg
                    else:
                        # If OCR also failed, include Gemini error in the main error
                        extracted_data['error'] = f"Gemini API failed: {error_msg}. OCR fallback also failed: {extracted_data.get('error', 'Unknown error')}"
            
        else:  # OCR fallback - basic extraction
            # Use regex patterns to extract basic info from text
            extracted_data = extract_basic_data_from_text(text_content)
        
        # Validate and clean data
        if 'items' not in extracted_data:
            extracted_data['items'] = []
        
        # Safely convert to float, handling None values
        def safe_float(value, default=0.0):
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        # Ensure numeric fields are floats
        for item in extracted_data.get('items', []):
            item['quantity'] = safe_float(item.get('quantity'))
            item['unit_price'] = safe_float(item.get('unit_price'))
            item['total_price'] = safe_float(item.get('total_price'))
        
        extracted_data['subtotal'] = safe_float(extracted_data.get('subtotal'))
        extracted_data['tax'] = safe_float(extracted_data.get('tax'))
        extracted_data['total'] = safe_float(extracted_data.get('total'))
        
        return extracted_data
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error extracting proforma data: {e}")
        
        # Handle specific OpenAI API errors
        if '429' in error_msg or 'insufficient_quota' in error_msg.lower():
            error_msg = "OpenAI API quota exceeded. Please check your OpenAI account billing or use a different API key."
        elif '401' in error_msg or 'invalid_api_key' in error_msg.lower():
            error_msg = "Invalid OpenAI API key. Please check your API key in settings."
        elif 'rate_limit' in error_msg.lower():
            error_msg = "OpenAI API rate limit exceeded. Please try again later."
        
        return {
            'error': error_msg,
            'vendor_name': '',
            'items': [],
            'total': 0.0,
            'extraction_failed': True
        }


def generate_purchase_order(purchase_request, proforma_data: Dict[str, Any]) -> ContentFile:
    """
    Generate a Purchase Order PDF document from purchase request and proforma data.
    
    Returns:
        ContentFile: PDF file content
    """
    from io import BytesIO
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    story.append(Paragraph("PURCHASE ORDER", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # PO Information
    po_info_data = [
        ['PO Number:', str(purchase_request.id)[:8].upper()],
        ['Date:', timezone.now().strftime('%Y-%m-%d')],
        ['Request ID:', str(purchase_request.id)],
    ]
    
    po_info_table = Table(po_info_data, colWidths=[2*inch, 4*inch])
    po_info_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(po_info_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Vendor Information
    vendor_data = [
        ['Vendor Information:', ''],
        ['Name:', proforma_data.get('vendor_name', 'N/A')],
        ['Address:', proforma_data.get('vendor_address', 'N/A')],
        ['Email:', proforma_data.get('vendor_email', 'N/A')],
        ['Phone:', proforma_data.get('vendor_phone', 'N/A')],
    ]
    
    vendor_table = Table(vendor_data, colWidths=[2*inch, 4*inch])
    vendor_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    story.append(vendor_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Items Table
    items_data = [['Description', 'Quantity', 'Unit Price', 'Total']]
    
    # Add items from purchase request
    for item in purchase_request.items.all():
        items_data.append([
            item.description,
            str(item.quantity),
            f"${item.unit_price:.2f}",
            f"${item.total_price:.2f}"
        ])
    
    # Add total row
    items_data.append([
        'TOTAL',
        '',
        '',
        f"${purchase_request.amount:.2f}"
    ])
    
    items_table = Table(items_data, colWidths=[3*inch, 1*inch, 1*inch, 1*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f0f0')),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Terms and Conditions
    terms_data = [
        ['Terms & Conditions:', ''],
        ['Payment Terms:', proforma_data.get('payment_terms', 'Net 30 days')],
        ['Delivery Terms:', proforma_data.get('delivery_terms', 'FOB Destination')],
    ]
    
    if proforma_data.get('notes'):
        terms_data.append(['Notes:', proforma_data.get('notes')])
    
    terms_table = Table(terms_data, colWidths=[2*inch, 4*inch])
    terms_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    story.append(terms_table)
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    # Create ContentFile
    filename = f"PO_{purchase_request.id}_{timezone.now().strftime('%Y%m%d')}.pdf"
    return ContentFile(buffer.read(), name=filename)


def validate_receipt(receipt_file_path_or_field, purchase_request) -> Dict[str, Any]:
    """
    Validate receipt against purchase order.
    Compares items, prices, and seller information.
    
    Returns:
        {
            'valid': bool,
            'discrepancies': [
                {
                    'type': 'item_mismatch' | 'price_mismatch' | 'seller_mismatch',
                    'description': str,
                    'expected': Any,
                    'actual': Any
                }
            ],
            'notes': str,
            'extracted_data': Dict
        }
    """
    try:
        # Extract data from receipt
        text_content = extract_text_from_file(receipt_file_path_or_field)
        
        prompt = f"""
        Extract the following information from this receipt document:
        
        1. Seller/Vendor Information:
           - Seller name
        
        2. Receipt Information:
           - Receipt number
           - Date
        
        3. Line Items (for each item):
           - Description
           - Quantity
           - Unit price
           - Total price
        
        4. Financial Information:
           - Subtotal
           - Tax amount
           - Total amount
        
        Return the data as a JSON object.
        
        Receipt text:
        """ + text_content[:4000]
        
        # Call AI API (OpenAI, Gemini, or OCR fallback)
        ai_provider = getattr(settings, 'AI_PROVIDER', 'gemini')
        
        if ai_provider == 'openai':
            client = get_openai_client()
            if not client:
                return {
                    'valid': False,
                    'discrepancies': [{'type': 'error', 'description': 'OpenAI API key not configured'}],
                    'notes': 'Cannot validate receipt without OpenAI API key',
                    'extracted_data': {}
                }
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting structured data from receipts. Always return valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            receipt_data = json.loads(response.choices[0].message.content)
            
        elif ai_provider == 'gemini':
            model = get_gemini_client()
            if not model:
                # Fallback to OCR if Gemini is not available
                print("Gemini model not available, falling back to OCR extraction")
                receipt_data = extract_basic_data_from_text(text_content)
            else:
                try:
                    full_prompt = f"""Extract structured data from this receipt document. Return ONLY valid JSON (no markdown):

{prompt}

Return JSON with: seller name, receipt number, date, items (description, quantity, unit_price, total_price), subtotal, tax, total."""
                    
                    response = model.generate_content(full_prompt)
                    response_text = response.text.strip()
                    if '```json' in response_text:
                        response_text = response_text.split('```json')[1].split('```')[0].strip()
                    elif '```' in response_text:
                        response_text = response_text.split('```')[1].split('```')[0].strip()
                    
                    receipt_data = json.loads(response_text)
                except Exception as gemini_error:
                    error_msg = str(gemini_error)
                    print(f"❌ Gemini API error: {error_msg}")
                    print("   Falling back to OCR extraction...")
                    # Fallback to OCR if Gemini fails
                    receipt_data = extract_basic_data_from_text(text_content)
                    # Add note about fallback
                    if isinstance(receipt_data, dict) and 'error' not in receipt_data:
                        receipt_data['_extraction_method'] = 'ocr_fallback'
                        receipt_data['_ai_error'] = error_msg
            
        else:  # OCR fallback
            receipt_data = extract_basic_data_from_text(text_content)
        
        # Get PO data from proforma (if available)
        proforma_data = {}
        if purchase_request.proforma:
            # In a real implementation, we'd extract this from stored proforma data
            # For now, we'll compare against purchase request items
            pass
        
        # Compare receipt with purchase request
        discrepancies = []
        
        # Compare seller name (if we have vendor info from proforma)
        # This would require storing proforma extracted data
        
        # Compare items
        receipt_items = receipt_data.get('items', [])
        po_items = list(purchase_request.items.all())
        
        if len(receipt_items) != len(po_items):
            discrepancies.append({
                'type': 'item_count_mismatch',
                'description': f'Item count mismatch: PO has {len(po_items)} items, receipt has {len(receipt_items)} items',
                'expected': len(po_items),
                'actual': len(receipt_items)
            })
        
        # Compare total amount (with tolerance)
        receipt_total = float(receipt_data.get('total', 0))
        po_total = float(purchase_request.amount)
        tolerance = 0.01  # 1 cent tolerance
        
        if abs(receipt_total - po_total) > tolerance:
            discrepancies.append({
                'type': 'price_mismatch',
                'description': f'Total amount mismatch: PO total is ${po_total:.2f}, receipt total is ${receipt_total:.2f}',
                'expected': po_total,
                'actual': receipt_total
            })
        
        # Compare individual items (simplified - would need better matching logic)
        for po_item in po_items:
            # Try to find matching item in receipt
            found = False
            for receipt_item in receipt_items:
                # Simple description matching (could be improved)
                if po_item.description.lower() in receipt_item.get('description', '').lower():
                    # Check quantity and price
                    receipt_qty = float(receipt_item.get('quantity', 0))
                    receipt_price = float(receipt_item.get('unit_price', 0))
                    
                    if abs(receipt_qty - float(po_item.quantity)) > 0.01:
                        discrepancies.append({
                            'type': 'quantity_mismatch',
                            'description': f'Quantity mismatch for {po_item.description}: PO has {po_item.quantity}, receipt has {receipt_qty}',
                            'expected': po_item.quantity,
                            'actual': receipt_qty
                        })
                    
                    if abs(receipt_price - float(po_item.unit_price)) > tolerance:
                        discrepancies.append({
                            'type': 'price_mismatch',
                            'description': f'Unit price mismatch for {po_item.description}: PO has ${po_item.unit_price:.2f}, receipt has ${receipt_price:.2f}',
                            'expected': po_item.unit_price,
                            'actual': receipt_price
                        })
                    
                    found = True
                    break
            
            if not found:
                discrepancies.append({
                    'type': 'item_mismatch',
                    'description': f'Item not found in receipt: {po_item.description}',
                    'expected': po_item.description,
                    'actual': 'Not found'
                })
        
        # Determine if valid
        is_valid = len(discrepancies) == 0
        
        notes = "Receipt validated successfully" if is_valid else f"Found {len(discrepancies)} discrepancy/discrepancies"
        
        return {
            'valid': is_valid,
            'discrepancies': discrepancies,
            'notes': notes,
            'extracted_data': receipt_data
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error validating receipt: {e}")
        
        # Handle specific OpenAI API errors
        if '429' in error_msg or 'insufficient_quota' in error_msg.lower():
            error_msg = "OpenAI API quota exceeded. Please check your OpenAI account billing or use a different API key."
        elif '401' in error_msg or 'invalid_api_key' in error_msg.lower():
            error_msg = "Invalid OpenAI API key. Please check your API key in settings."
        elif 'rate_limit' in error_msg.lower():
            error_msg = "OpenAI API rate limit exceeded. Please try again later."
        
        return {
            'valid': False,
            'discrepancies': [{'type': 'error', 'description': error_msg}],
            'notes': f'Error during validation: {error_msg}',
            'extracted_data': {}
        }

