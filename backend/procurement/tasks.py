"""
Celery tasks for procurement app.
Handles background processing of documents and other async operations.
"""
import logging
from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import PurchaseRequest, RequestItem
from .document_processing import extract_proforma_data, generate_purchase_order, validate_receipt

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_proforma(self, request_id):
    """
    Process proforma document asynchronously.
    
    Args:
        request_id: UUID of the PurchaseRequest
        
    Returns:
        dict: Status and extracted data or error message
    """
    try:
        # Get the purchase request
        purchase_request = PurchaseRequest.objects.get(id=request_id)
        
        if not purchase_request.proforma:
            logger.warning(f"PurchaseRequest {request_id} has no proforma file")
            return {"status": "error", "error": "No proforma file found"}
        
        logger.info(f"Processing proforma for request {request_id}")
        
        # Extract data from proforma
        extracted_data = extract_proforma_data(
            purchase_request.proforma,
            purchase_request.proforma.name
        )
        
        # Update purchase request with extracted data
        purchase_request.proforma_extracted_data = extracted_data
        purchase_request.save()
        
        # Automatically create RequestItem objects from extracted proforma items
        # Only create items from proforma if no manual items were provided
        if extracted_data and 'items' in extracted_data and extracted_data['items']:
            # Only create items if none were provided manually
            if not purchase_request.items.exists():
                items_created = 0
                for item_data in extracted_data['items']:
                    try:
                        description = item_data.get('description', '')
                        quantity = item_data.get('quantity', 1)
                        unit_price = item_data.get('unit_price', 0)
                        
                        if description:  # Only create if description is not empty
                            RequestItem.objects.create(
                                purchase_request=purchase_request,
                                description=str(description),
                                quantity=int(quantity),
                                unit_price=float(unit_price)
                            )
                            items_created += 1
                    except Exception as item_error:
                        logger.error(f"Error creating item from proforma: {item_error}")
                        continue
                
                logger.info(f"Created {items_created} items from proforma for request {request_id}")
            else:
                logger.info(f"Manual items exist for request {request_id}, skipping proforma item creation")
        
        logger.info(f"Successfully processed proforma for request {request_id}")
        return {
            "status": "success",
            "request_id": str(request_id),
            "extracted_data": extracted_data
        }
        
    except PurchaseRequest.DoesNotExist:
        error_msg = f"PurchaseRequest {request_id} not found"
        logger.error(error_msg)
        return {"status": "error", "error": error_msg}
        
    except Exception as exc:
        # Log the error
        logger.error(f"Error processing proforma for request {request_id}: {exc}", exc_info=True)
        
        # Retry the task
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_purchase_order_task(self, request_id):
    """
    Generate purchase order document asynchronously.
    
    Args:
        request_id: UUID of the PurchaseRequest
        
    Returns:
        dict: Status and PO file path or error message
    """
    try:
        # Get the purchase request
        purchase_request = PurchaseRequest.objects.get(id=request_id)
        
        if purchase_request.status != 'approved':
            error_msg = f"PurchaseRequest {request_id} is not approved"
            logger.warning(error_msg)
            return {"status": "error", "error": error_msg}
        
        if purchase_request.purchase_order:
            logger.info(f"PurchaseRequest {request_id} already has a PO")
            return {
                "status": "success",
                "request_id": str(request_id),
                "message": "PO already exists"
            }
        
        logger.info(f"Generating PO for request {request_id}")
        
        # Get proforma data for PO generation
        proforma_data = purchase_request.proforma_extracted_data or {}
        
        # Generate PO
        po_file = generate_purchase_order(purchase_request, proforma_data)
        
        if po_file:
            # Save PO to purchase request
            # Ensure we're saving to the volume location (MEDIA_ROOT)
            from django.conf import settings
            import os
            
            # Ensure the purchase_orders directory exists in MEDIA_ROOT
            media_root = settings.MEDIA_ROOT
            po_dir = os.path.join(media_root, 'purchase_orders')
            os.makedirs(po_dir, exist_ok=True)
            
            # Verify the directory is writable (volume should be mounted here)
            if not os.access(po_dir, os.W_OK):
                error_msg = f"PO directory is not writable: {po_dir}. Volume may not be mounted on this machine."
                logger.error(error_msg)
                return {"status": "error", "error": error_msg}
            
            # Save PO to purchase request
            # Django's FileField.save() will use MEDIA_ROOT which should be the volume
            purchase_request.purchase_order.save(
                po_file.name,
                po_file,
                save=True
            )
            
            # Verify file was saved correctly
            if purchase_request.purchase_order:
                # Check if file exists on disk (for local storage)
                if hasattr(purchase_request.purchase_order, 'path'):
                    file_path = purchase_request.purchase_order.path
                    if os.path.exists(file_path):
                        file_size = os.path.getsize(file_path)
                        logger.info(f"PO file saved successfully: {file_path} ({file_size} bytes)")
                    else:
                        logger.warning(f"PO file path exists but file not found: {file_path}")
                        logger.warning("This may indicate the volume is not mounted on this machine.")
            
            logger.info(f"Successfully generated PO for request {request_id}")
            return {
                "status": "success",
                "request_id": str(request_id),
                "po_file": purchase_request.purchase_order.url if purchase_request.purchase_order else None
            }
        else:
            error_msg = "Failed to generate PO file"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg}
            
    except PurchaseRequest.DoesNotExist:
        error_msg = f"PurchaseRequest {request_id} not found"
        logger.error(error_msg)
        return {"status": "error", "error": error_msg}
        
    except Exception as exc:
        # Log the error
        logger.error(f"Error generating PO for request {request_id}: {exc}", exc_info=True)
        
        # Retry the task
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def validate_receipt_task(self, request_id):
    """
    Validate receipt document asynchronously.
    
    Args:
        request_id: UUID of the PurchaseRequest
        
    Returns:
        dict: Status and validation results or error message
    """
    try:
        # Get the purchase request
        purchase_request = PurchaseRequest.objects.get(id=request_id)
        
        if not purchase_request.receipt:
            error_msg = f"PurchaseRequest {request_id} has no receipt file"
            logger.warning(error_msg)
            return {"status": "error", "error": error_msg}
        
        if not purchase_request.purchase_order:
            error_msg = f"PurchaseRequest {request_id} has no PO to validate against"
            logger.warning(error_msg)
            return {"status": "error", "error": error_msg}
        
        logger.info(f"Validating receipt for request {request_id}")
        
        # Validate receipt
        validation_result = validate_receipt(
            purchase_request.receipt,
            purchase_request
        )
        
        # Update purchase request with validation results
        purchase_request.receipt_validated = validation_result.get('valid', False)
        purchase_request.receipt_validation_notes = validation_result.get('notes', '')
        
        # Store discrepancies in notes if any
        if validation_result.get('discrepancies'):
            discrepancies_text = "\n".join([
                f"- {d.get('description', 'Unknown discrepancy')}"
                for d in validation_result['discrepancies']
            ])
            purchase_request.receipt_validation_notes = (
                f"{validation_result.get('notes', '')}\n\nDiscrepancies:\n{discrepancies_text}"
            )
        
        purchase_request.save()
        
        logger.info(f"Receipt validation completed for request {request_id}: {validation_result.get('valid')}")
        return {
            "status": "success",
            "request_id": str(request_id),
            "validation_result": validation_result
        }
        
    except PurchaseRequest.DoesNotExist:
        error_msg = f"PurchaseRequest {request_id} not found"
        logger.error(error_msg)
        return {"status": "error", "error": error_msg}
        
    except Exception as exc:
        # Log the error
        logger.error(f"Error validating receipt for request {request_id}: {exc}", exc_info=True)
        
        # Retry the task
        raise self.retry(exc=exc)

