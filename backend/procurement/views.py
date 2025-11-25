from rest_framework import status, generics, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import logging
from .models import (
    UserProfile,
    PurchaseRequest,
    RequestItem,
    Approval,
    RequestType,
    ApprovalLevel,
)
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
    UserProfileSerializer,
    PurchaseRequestListSerializer,
    PurchaseRequestDetailSerializer,
    PurchaseRequestCreateSerializer,
    PurchaseRequestUpdateSerializer,
    ApprovalSerializer,
    ApprovalActionSerializer,
    ReceiptSubmissionSerializer,
    RequestTypeSerializer,
    ApprovalLevelSerializer,
)
from .permissions import IsStaff, IsFinance, IsApprover, IsOwnerOrReadOnly, IsAdmin
# Document processing is now handled by Celery tasks
# from .document_processing import (
#     extract_proforma_data,
#     generate_purchase_order,
#     validate_receipt,
# )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer to include user profile information."""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['user_id'] = user.id
        token['username'] = user.username
        
        # Superusers get 'admin' role
        if user.is_superuser:
            token['role'] = 'admin'
        else:
            try:
                profile = user.profile
                token['role'] = profile.role
            except UserProfile.DoesNotExist:
                token['role'] = None
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user information to response
        user = self.user
        if user.is_superuser:
            data['user'] = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'admin',
                'role_display': 'Administrator',
            }
        else:
            try:
                profile = user.profile
                data['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': profile.role,
                    'role_display': profile.get_role_display(),
                }
            except UserProfile.DoesNotExist:
                data['user'] = {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': None,
                    'role_display': None,
                }
        
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token obtain view with user profile information."""
    serializer_class = CustomTokenObtainPairSerializer


def send_user_creation_email(user, password):
    """
    Send email to newly created user with their login credentials.
    
    Args:
        user: User instance
        password: Generated password
    """
    logger = logging.getLogger(__name__)
    
    subject = 'Welcome to Procure-to-Pay System - Your Account Credentials'
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    
    message = f"""Hello {user.get_full_name() or user.username},

Your account has been created in the Procure-to-Pay system.

Login Credentials:
- Username: {user.username}
- Password: {password}

Please log in at: {frontend_url}/login

For security reasons, please change your password after your first login.

If you have any questions, please contact the system administrator.

Best regards,
Procure-to-Pay System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Email sent successfully to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send email to {user.email}: {str(e)}")
        raise


@swagger_auto_schema(
    method='post',
    request_body=UserRegistrationSerializer,
    responses={
        201: openapi.Response(
            description='User registered successfully',
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'user': openapi.Schema(type=openapi.TYPE_OBJECT),
                }
            )
        ),
        400: 'Bad Request - Validation errors'
    },
    operation_description='Register a new user account with a user profile. Creates both User and UserProfile records.',
    operation_summary='Register a new user'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user.
    
    Creates a new user account with a user profile.
    If password is not provided, generates a random password and sends it via email.
    """
    serializer = UserRegistrationSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = serializer.save()
        
        # Send email if password was generated
        generated_password = serializer.context.get('generated_password')
        if generated_password:
            try:
                send_user_creation_email(user, generated_password)
            except Exception as e:
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send email to {user.email}: {str(e)}")
                # Continue even if email fails - user is still created
        
        return Response(
            {
                'message': 'User registered successfully',
                'user': UserSerializer(user).data,
                'password_sent': bool(generated_password)
            },
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """View to retrieve and update current user's profile."""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description='Retrieve current user profile information.',
        operation_summary='Get user profile',
        security=[{'Bearer': []}]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Update current user profile information (department, phone, address). Note: Department can only be updated by admin users.',
        operation_summary='Update user profile',
        security=[{'Bearer': []}]
    )
    def patch(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Update current user profile information (department, phone, address). Note: Department can only be updated by admin users.',
        operation_summary='Update user profile',
        security=[{'Bearer': []}]
    )
    def put(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Update profile with department restriction for non-admin users."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if user is admin or superuser
        is_admin = request.user.is_superuser or (
            hasattr(request.user, 'profile') and 
            request.user.profile.role == 'admin'
        )
        
        # If not admin, remove department from request data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not is_admin and 'department' in data:
            data.pop('department', None)
            # Return error if non-admin tries to update department
            if 'department' in request.data:
                return Response(
                    {"error": "Only administrators can update the department field."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        return Response(serializer.data)
    
    def get_object(self):
        """Get the current user's profile."""
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


class UserDetailView(generics.RetrieveUpdateAPIView):
    """View to retrieve and update current user's details."""
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description='Retrieve current authenticated user details including profile.',
        operation_summary='Get user details',
        security=[{'Bearer': []}]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Update current user account information (first_name, last_name, email, username). Note: Username can only be updated by admin users.',
        operation_summary='Update user account',
        security=[{'Bearer': []}]
    )
    def patch(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Update current user account information (first_name, last_name, email, username). Note: Username can only be updated by admin users.',
        operation_summary='Update user account',
        security=[{'Bearer': []}]
    )
    def put(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Update user account with username restriction for non-admin users."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if user is admin or superuser
        is_admin = request.user.is_superuser or (
            hasattr(request.user, 'profile') and 
            request.user.profile.role == 'admin'
        )
        
        # If not admin, remove username from request data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not is_admin and 'username' in data:
            data.pop('username', None)
            # Return error if non-admin tries to update username
            if 'username' in request.data:
                return Response(
                    {"error": "Only administrators can update the username field."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        return Response(serializer.data)
    
    def get_object(self):
        """Get the current user."""
        return self.request.user


def health_check(request):
    """Health check endpoint for monitoring - bypasses DRF and middleware."""
    from django.http import JsonResponse
    # Simple health check that always returns 200
    # This bypasses ALLOWED_HOSTS check by using a simple view
    return JsonResponse({'status': 'healthy'}, status=200)


@swagger_auto_schema(
    method='get',
    operation_description='Get current authenticated user information including profile details.',
    operation_summary='Get current user information',
    security=[{'Bearer': []}]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Get current authenticated user information.
    
    Returns user details in the same format as login endpoint.
    """
    user = request.user
    
    # Handle superusers (same as login endpoint)
    if user.is_superuser:
        user_data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': 'admin',
            'role_display': 'Administrator',
            'is_superuser': True,
        }
    else:
        # Handle regular users with profile
        try:
            profile = user.profile
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': profile.role,
                'role_display': profile.get_role_display(),
                'is_superuser': False,
            }
        except UserProfile.DoesNotExist:
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': None,
                'role_display': None,
                'is_superuser': False,
            }
    
    return Response(user_data)


# Purchase Request Views

class PurchaseRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PurchaseRequest CRUD operations.
    
    - Staff can create and manage their own requests
    - Approvers can view all requests
    - Finance can view all requests
    """
    queryset = PurchaseRequest.objects.all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # Support file uploads
    
    def get_serializer_class(self):
        """Return appropriate serializer class based on action."""
        # For Swagger schema generation, we want to use our custom schemas
        # but for actual requests, we need the serializers
        if self.action == 'create':
            return PurchaseRequestCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PurchaseRequestUpdateSerializer
        elif self.action == 'retrieve':
            return PurchaseRequestDetailSerializer
        return PurchaseRequestListSerializer
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        # Handle Swagger schema generation (no real request)
        if getattr(self, 'swagger_fake_view', False):
            return PurchaseRequest.objects.none()
        
        user = self.request.user
        
        # Handle anonymous users (during schema generation)
        if not user or not user.is_authenticated:
            return PurchaseRequest.objects.none()
        
        queryset = PurchaseRequest.objects.select_related(
            'request_type', 'created_by', 'approved_by'
        ).prefetch_related('items', 'approvals')
        
        # Superusers can see all requests
        if user.is_superuser:
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            return queryset
        
        try:
            profile = user.profile
            # Staff can only see their own requests
            if profile.role == 'staff':
                queryset = queryset.filter(created_by=user)
            # Approvers and Finance can see all requests
            
            # Filter by status if provided
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            return queryset
        except UserProfile.DoesNotExist:
            return PurchaseRequest.objects.none()
    
    @swagger_auto_schema(
        operation_description='List all purchase requests. Filtered by creator if user is staff.',
        operation_summary='List purchase requests',
        security=[{'Bearer': []}],
        manual_parameters=[
            openapi.Parameter('status', openapi.IN_QUERY, description="Filter by status (pending/approved/rejected)", type=openapi.TYPE_STRING),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Create a new purchase request. Only staff can create requests. Supports file upload for proforma. IMPORTANT: Use "multipart/form-data" content type (not application/json).',
        operation_summary='Create purchase request',
        security=[{'Bearer': []}],
        request_body=PurchaseRequestCreateSerializer,
        responses={201: PurchaseRequestDetailSerializer},
        consumes=['multipart/form-data']
    )
    def create(self, request, *args, **kwargs):
        """Create a new purchase request."""
        # Superusers can create requests
        if not request.user.is_superuser:
            try:
                profile = request.user.profile
                if profile.role != 'staff':
                    return Response(
                        {"error": "Only staff can create purchase requests."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except UserProfile.DoesNotExist:
                return Response(
                    {"error": "User profile not found."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Set submitted_at when creating
        purchase_request = serializer.save()
        purchase_request.submitted_at = timezone.now()
        purchase_request.save()
        
        # Trigger background task to process proforma if uploaded
        if purchase_request.proforma:
            from .tasks import process_proforma
            process_proforma.delay(str(purchase_request.id))
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            PurchaseRequestDetailSerializer(purchase_request).data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    @swagger_auto_schema(
        operation_description='Retrieve a purchase request by ID.',
        operation_summary='Get purchase request details',
        security=[{'Bearer': []}]
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)
    
    @swagger_auto_schema(
        operation_description='Update a purchase request. Only staff can update their own pending requests. Supports file upload for proforma. IMPORTANT: Use "multipart/form-data" content type (not application/json).',
        operation_summary='Update purchase request',
        security=[{'Bearer': []}],
        request_body=PurchaseRequestUpdateSerializer,
        responses={200: PurchaseRequestDetailSerializer},
        consumes=['multipart/form-data']
    )
    def update(self, request, *args, **kwargs):
        """Update purchase request (only if pending and owner)."""
        instance = self.get_object()
        
        # Superusers can update any request
        if not request.user.is_superuser:
            # Check if user is the creator
            if instance.created_by != request.user:
                return Response(
                    {"error": "You can only update your own requests."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check if request can be edited (unless superuser)
        if not request.user.is_superuser and not instance.can_be_edited:
            return Response(
                {"error": "Cannot update request that is not in pending status."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Refresh instance to get updated data
        instance.refresh_from_db()
        
        # Trigger background task to process proforma if file was updated
        if 'proforma' in request.data and instance.proforma:
            from .tasks import process_proforma
            process_proforma.delay(str(instance.id))
        
        return Response(PurchaseRequestDetailSerializer(instance).data)
    
    @swagger_auto_schema(
        operation_description='Partially update a purchase request. Supports file upload for proforma. IMPORTANT: Use "multipart/form-data" content type (not application/json).',
        operation_summary='Partially update purchase request',
        security=[{'Bearer': []}],
        request_body=PurchaseRequestUpdateSerializer,
        responses={200: PurchaseRequestDetailSerializer},
        consumes=['multipart/form-data']
    )
    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
    
    @swagger_auto_schema(
        method='patch',
        operation_description='Approve a purchase request at the approver\'s level.',
        operation_summary='Approve purchase request',
        security=[{'Bearer': []}],
        request_body=ApprovalActionSerializer,
        responses={200: PurchaseRequestDetailSerializer}
    )
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsApprover])
    def approve(self, request, pk=None):
        """Approve a purchase request."""
        return self._handle_approval_action(request, pk, 'approved')
    
    @swagger_auto_schema(
        method='patch',
        operation_description='Reject a purchase request. This will set status to rejected.',
        operation_summary='Reject purchase request',
        security=[{'Bearer': []}],
        request_body=ApprovalActionSerializer,
        responses={200: PurchaseRequestDetailSerializer}
    )
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsApprover])
    def reject(self, request, pk=None):
        """Reject a purchase request."""
        return self._handle_approval_action(request, pk, 'rejected')
    
    def _handle_approval_action(self, request, pk, action):
        """Handle approval or rejection action with concurrency safety."""
        purchase_request = self.get_object()
        user = request.user
        
        # Superusers can approve/reject any request
        if user.is_superuser:
            # For superusers, we'll use a default approval level or skip level check
            profile = None
        else:
            try:
                profile = user.profile
            except UserProfile.DoesNotExist:
                return Response(
                    {"error": "User profile not found."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check if request is in pending status
        if purchase_request.status != 'pending':
            return Response(
                {"error": f"Cannot {action} request that is not in pending status."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get approval levels for this request type
        approval_levels = ApprovalLevel.objects.filter(
            request_type=purchase_request.request_type,
            is_required=True
        ).order_by('level_number')
        
        if not approval_levels.exists():
            return Response(
                {"error": "No approval levels configured for this request type."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For superusers, use the first approval level (or highest level)
        if user.is_superuser:
            user_approval_level = approval_levels.last() or approval_levels.first()
        else:
            # Find the approval level that matches user's role
            user_approval_level = None
            for level in approval_levels:
                if level.approver_role == profile.role:
                    user_approval_level = level
                    break
            
            if not user_approval_level:
                return Response(
                    {"error": f"User role '{profile.role}' is not authorized to approve this request type."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check if user has already approved at this level
        existing_approval = Approval.objects.filter(
            purchase_request=purchase_request,
            approval_level=user_approval_level,
            approver=user
        ).first()
        
        if existing_approval:
            return Response(
                {"error": "You have already provided approval for this request at this level."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comments = serializer.validated_data.get('comments', '')
        
        # Use database transaction for concurrency safety
        with transaction.atomic():
            # Lock the purchase request row
            purchase_request = PurchaseRequest.objects.select_for_update().get(pk=purchase_request.pk)
            
            # Double-check status hasn't changed
            if purchase_request.status != 'pending':
                return Response(
                    {"error": f"Request status has changed. Current status: {purchase_request.status}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create approval record
            approval = Approval.objects.create(
                purchase_request=purchase_request,
                approver=user,
                approval_level=user_approval_level,
                action=action,
                comments=comments,
                created_by=user
            )
            
            # Set timestamps based on action
            if action == 'approved':
                approval.approved_at = timezone.now()
            elif action == 'rejected':
                approval.rejected_at = timezone.now()
            approval.save()
            
            # If rejected, immediately set request status to rejected
            if action == 'rejected':
                purchase_request.status = 'rejected'
                purchase_request.save()
            else:
                # Check if all required approvals are complete
                required_levels = approval_levels.count()
                approved_levels = Approval.objects.filter(
                    purchase_request=purchase_request,
                    action='approved'
                ).values_list('approval_level', flat=True).distinct().count()
                
                # If all required levels are approved, set status to approved
                if approved_levels >= required_levels:
                    purchase_request.status = 'approved'
                    purchase_request.approved_by = user
                    purchase_request.save()
                    
                    # Generate Purchase Order automatically in background
                    from .tasks import generate_purchase_order_task
                    generate_purchase_order_task.delay(str(purchase_request.id))
            
            # Refresh from database
            purchase_request.refresh_from_db()
        
        return Response(
            PurchaseRequestDetailSerializer(purchase_request).data,
            status=status.HTTP_200_OK
        )
    
    @swagger_auto_schema(
        method='post',
        operation_description='Submit a receipt for a purchase request. Only staff can submit receipts. Receipt will be validated against the Purchase Order. IMPORTANT: Use "multipart/form-data" content type (not application/json).',
        operation_summary='Submit receipt',
        security=[{'Bearer': []}],
        request_body=ReceiptSubmissionSerializer,
        responses={200: PurchaseRequestDetailSerializer},
        consumes=['multipart/form-data']
    )
    @action(detail=True, methods=['post'], url_path='submit-receipt', permission_classes=[IsAuthenticated, IsStaff])
    def submit_receipt(self, request, pk=None):
        """Submit receipt for a purchase request."""
        purchase_request = self.get_object()
        
        # Superusers can submit receipts for any request
        if not request.user.is_superuser:
            # Check if user is the creator
            if purchase_request.created_by != request.user:
                return Response(
                    {"error": "You can only submit receipts for your own requests."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check if request is approved
        if purchase_request.status != 'approved':
            return Response(
                {"error": "Can only submit receipt for approved requests."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ReceiptSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save receipt file
        purchase_request.receipt = serializer.validated_data['receipt']
        purchase_request.save()
        
        # Trigger background task to validate receipt
        from .tasks import validate_receipt_task
        validate_receipt_task.delay(str(purchase_request.id))
        
        return Response(
            PurchaseRequestDetailSerializer(purchase_request).data,
            status=status.HTTP_200_OK
        )


# Request Type Views

class RequestTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for RequestType CRUD operations (admin only for write operations)."""
    queryset = RequestType.objects.all()
    serializer_class = RequestTypeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Allow read for authenticated users, write for admin only."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        queryset = RequestType.objects.all()
        # Non-admin users only see active request types
        if not (self.request.user.is_superuser or 
                (hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'admin')):
            queryset = queryset.filter(is_active=True)
        return queryset


# Approval Level Views

class ApprovalLevelViewSet(viewsets.ModelViewSet):
    """ViewSet for ApprovalLevel CRUD operations (admin only)."""
    queryset = ApprovalLevel.objects.select_related('request_type').all()
    serializer_class = ApprovalLevelSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        """Filter queryset by request_type if provided."""
        queryset = ApprovalLevel.objects.select_related('request_type').all()
        request_type_id = self.request.query_params.get('request_type', None)
        if request_type_id:
            queryset = queryset.filter(request_type_id=request_type_id)
        return queryset.order_by('request_type', 'level_number')


# User Management Views (Admin only)

class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management (admin only)."""
    queryset = User.objects.select_related('profile').all()
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return UserListSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'create':
            return UserRegistrationSerializer
        return UserDetailSerializer
    
    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = User.objects.select_related('profile').all()
        
        # Filter by role if provided
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(profile__role=role)
        
        # Filter by active status if provided
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active_bool)
        
        return queryset.order_by('-date_joined')
    
    def perform_create(self, serializer):
        """Create user with profile and send email with password."""
        # Pass request context to serializer
        serializer.context['request'] = self.request
        user = serializer.save()
        
        # Get generated password from serializer context
        generated_password = serializer.context.get('generated_password')
        
        # Send email with password if password was generated
        if generated_password:
            try:
                send_user_creation_email(user, generated_password)
            except Exception as e:
                # Log error but don't fail user creation
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send email to {user.email}: {str(e)}")
                # Continue - user is created even if email fails
    
    def perform_destroy(self, instance):
        """Prevent deleting superuser accounts."""
        if instance.is_superuser:
            raise ValidationError("Cannot delete superuser accounts.")
        instance.delete()

