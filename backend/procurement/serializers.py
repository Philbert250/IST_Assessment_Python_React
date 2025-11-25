from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError
from .models import (
    UserProfile,
    PurchaseRequest,
    RequestItem,
    Approval,
    RequestType,
    ApprovalLevel,
)


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    department_display = serializers.CharField(source='get_department_display', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ['id', 'role', 'role_display', 'department', 'department_display', 
                  'phone_number', 'address', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model with profile."""
    profile = UserProfileSerializer(read_only=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'password', 'password_confirm', 'profile', 'date_joined']
        read_only_fields = ['id', 'date_joined']
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }
    
    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        """Create user and profile."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        
        # Create user profile with default role 'staff'
        UserProfile.objects.create(user=user, role='staff')
        
        return user


class UserRegistrationSerializer(serializers.Serializer):
    """Serializer for user registration with role."""
    username = serializers.CharField(required=True, max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, default='staff')
    department = serializers.ChoiceField(choices=UserProfile.DEPARTMENT_CHOICES, required=False, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=15)
    address = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, attrs):
        """Validate that passwords match (if provided) and username is unique."""
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        
        # If password is provided, both password and password_confirm must be provided and match
        if password or password_confirm:
            if not password or not password_confirm:
                raise serializers.ValidationError({"password": "Both password and password confirmation are required if password is provided."})
            if password != password_confirm:
                raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        # Only check username uniqueness (email can be duplicate)
        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})
        
        return attrs
    
    def create(self, validated_data):
        """Create user and profile."""
        password = validated_data.pop('password', None)
        password_confirm = validated_data.pop('password_confirm', None)
        role = validated_data.pop('role', 'staff')
        department = validated_data.pop('department', None)
        phone_number = validated_data.pop('phone_number', None)
        address = validated_data.pop('address', None)
        
        # Generate random password if not provided
        if not password:
            import random
            import string
            # Generate password like "Pass232" - 4 letters + 3 digits
            letters = ''.join(random.choices(string.ascii_letters, k=4))
            digits = ''.join(random.choices(string.digits, k=3))
            password = letters + digits
        
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        
        # Create user profile
        UserProfile.objects.create(
            user=user,
            role=role,
            department=department,
            phone_number=phone_number,
            address=address
        )
        
        # Store generated password in context for email sending
        self.context['generated_password'] = password
        
        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer for user details with profile."""
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'profile', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def validate_username(self, value):
        """Validate username uniqueness."""
        # Check if username already exists (excluding current user)
        if self.instance:
            if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("A user with this username already exists.")
        else:
            if User.objects.filter(username=value).exists():
                raise serializers.ValidationError("A user with this username already exists.")
        return value


# Purchase Request Serializers

class RequestTypeSerializer(serializers.ModelSerializer):
    """Serializer for RequestType model."""
    
    class Meta:
        model = RequestType
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_name(self, value):
        """Validate that name is unique (case-insensitive)."""
        queryset = RequestType.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A request type with this name already exists.")
        return value


class ApprovalLevelSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalLevel model."""
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    approver_role_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ApprovalLevel
        fields = [
            'id', 'request_type', 'request_type_name', 'level_number', 
            'approver_role', 'approver_role_display', 'is_required', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_approver_role_display(self, obj):
        """Get approver role display string."""
        return obj.get_approver_role_display() if hasattr(obj, 'get_approver_role_display') else obj.approver_role
    
    def validate(self, attrs):
        """Validate that level_number is unique for the request_type."""
        request_type = attrs.get('request_type') or (self.instance.request_type if self.instance else None)
        level_number = attrs.get('level_number') or (self.instance.level_number if self.instance else None)
        
        if request_type and level_number:
            queryset = ApprovalLevel.objects.filter(
                request_type=request_type,
                level_number=level_number
            )
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"level_number": f"An approval level with number {level_number} already exists for this request type."}
                )
        return attrs


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for User list view (minimal fields)."""
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source='profile.role', read_only=True)
    role_display = serializers.CharField(source='profile.get_role_display', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'role', 'role_display', 'date_joined', 'is_active']
        read_only_fields = ['id', 'date_joined']


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating User."""
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'is_active', 'profile']
    
    def validate_username(self, value):
        """Validate username uniqueness."""
        # Check if username already exists (excluding current user)
        if self.instance:
            if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("A user with this username already exists.")
        else:
            if User.objects.filter(username=value).exists():
                raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def update(self, instance, validated_data):
        """Update user and profile."""
        profile_data = validated_data.pop('profile', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update profile if provided
        if profile_data:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        
        return instance


class RequestItemSerializer(serializers.ModelSerializer):
    """Serializer for RequestItem model."""
    
    class Meta:
        model = RequestItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price', 'created_at']
        read_only_fields = ['id', 'total_price', 'created_at']


class ItemsField(serializers.Field):
    """Custom field to handle items as JSON string in multipart/form-data."""
    
    def to_internal_value(self, data):
        """Parse items from JSON string or list."""
        if isinstance(data, str):
            try:
                import json
                parsed = json.loads(data)
                return parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError as e:
                # Log JSON parsing error
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to parse items JSON: {e}, data: {data[:100]}")
                raise serializers.ValidationError(f"Invalid JSON format for items: {str(e)}")
            except (TypeError, ValueError) as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error parsing items: {e}, data: {data[:100]}")
                return []
        elif isinstance(data, list):
            return data
        return []
    
    def to_representation(self, value):
        """Return items as list."""
        if hasattr(value, 'all'):
            # It's a queryset
            return RequestItemSerializer(value.all(), many=True).data
        return value


class ApprovalSerializer(serializers.ModelSerializer):
    """Serializer for Approval model."""
    approver_username = serializers.CharField(source='approver.username', read_only=True)
    approver_email = serializers.EmailField(source='approver.email', read_only=True)
    approval_level_display = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = Approval
        fields = [
            'id', 'purchase_request', 'approver', 'approver_username', 'approver_email',
            'approval_level', 'approval_level_display', 'action', 'action_display',
            'comments', 'created_at', 'updated_at', 'submitted_at', 'approved_at',
            'rejected_at', 'cancelled_at'
        ]
        read_only_fields = [
            'id', 'approver', 'created_at', 'updated_at', 'submitted_at',
            'approved_at', 'rejected_at', 'cancelled_at'
        ]
    
    def get_approval_level_display(self, obj):
        """Get approval level display string."""
        if obj.approval_level:
            return f"Level {obj.approval_level.level_number} - {obj.approval_level.approver_role}"
        return None


class PurchaseRequestListSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseRequest list view (minimal fields)."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True, allow_null=True)
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)
    
    class Meta:
        model = PurchaseRequest
        fields = [
            'id', 'title', 'amount', 'status', 'status_display', 'request_type',
            'request_type_name', 'created_by', 'created_by_username', 'approved_by',
            'approved_by_username', 'created_at', 'updated_at', 'submitted_at', 'approvals'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'submitted_at']


class PurchaseRequestDetailSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseRequest detail view (all fields)."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True, allow_null=True)
    request_type = RequestTypeSerializer(read_only=True)
    request_type_id = serializers.UUIDField(write_only=True, required=False)
    items = RequestItemSerializer(many=True, read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_be_edited = serializers.BooleanField(read_only=True)
    is_final_status = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PurchaseRequest
        fields = [
            'id', 'title', 'description', 'amount', 'status', 'status_display',
            'request_type', 'request_type_id', 'created_by', 'created_by_username',
            'created_by_email', 'approved_by', 'approved_by_username',
            'proforma', 'purchase_order', 'receipt', 'items', 'approvals',
            'created_at', 'updated_at', 'submitted_at', 'receipt_validated',
            'receipt_validation_notes', 'proforma_extracted_data',
            'can_be_edited', 'is_final_status'
        ]
        read_only_fields = [
            'id', 'created_by', 'approved_by', 'purchase_order', 'created_at',
            'updated_at', 'submitted_at', 'can_be_edited', 'is_final_status'
        ]
    
    def validate_request_type_id(self, value):
        """Validate that request_type exists."""
        try:
            RequestType.objects.get(id=value, is_active=True)
        except RequestType.DoesNotExist:
            raise serializers.ValidationError("Request type does not exist or is not active.")
        return value
    
    def validate(self, attrs):
        """Validate request data."""
        # If status is being changed, validate it
        if 'status' in attrs:
            if self.instance and self.instance.is_final_status:
                raise serializers.ValidationError(
                    {"status": "Cannot change status of approved or rejected requests."}
                )
        return attrs


class PurchaseRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating PurchaseRequest."""
    request_type_id = serializers.UUIDField(required=True)
    items = ItemsField(required=False, allow_null=True)
    
    class Meta:
        model = PurchaseRequest
        fields = [
            'title', 'description', 'amount', 'request_type_id', 'proforma', 'items'
        ]
    
    def to_internal_value(self, data):
        """Handle items as JSON string from multipart/form-data."""
        # Parse items before validation
        if 'items' in data:
            items_value = data.get('items')
            
            # Use our custom field to parse items
            items_field = ItemsField()
            try:
                parsed_items = items_field.to_internal_value(items_value)
                data = data.copy()
                data['items'] = parsed_items
            except Exception as e:
                # If parsing fails, set to empty list
                data = data.copy()
                data['items'] = []
        else:
            data = data.copy()
            data['items'] = []
        
        return super().to_internal_value(data)
    
    def validate_proforma(self, value):
        """Validate proforma file."""
        if value:
            # Check file size
            if value.size > settings.MAX_UPLOAD_SIZE:
                raise serializers.ValidationError(
                    f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
                )
            
            # Check file type
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in settings.ALLOWED_FILE_TYPES:
                raise serializers.ValidationError(
                    f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_FILE_TYPES)}"
                )
        
        return value
    
    def validate_request_type_id(self, value):
        """Validate that request_type exists and is active."""
        try:
            request_type = RequestType.objects.get(id=value, is_active=True)
        except RequestType.DoesNotExist:
            raise serializers.ValidationError("Request type does not exist or is not active.")
        return value
    
    def create(self, validated_data):
        """Create purchase request with items."""
        items_data = validated_data.pop('items', [])
        request_type_id = validated_data.pop('request_type_id')
        request_type = RequestType.objects.get(id=request_type_id)
        
        # Set created_by from request user
        validated_data['created_by'] = self.context['request'].user
        validated_data['request_type'] = request_type
        
        # Create purchase request
        purchase_request = PurchaseRequest.objects.create(**validated_data)
        
        # Create request items if provided
        if items_data and len(items_data) > 0:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Creating {len(items_data)} manual items for request {purchase_request.id}")
            
            for item_data in items_data:
                try:
                    # Handle dict-like objects (dict, OrderedDict, etc.)
                    if isinstance(item_data, dict) or hasattr(item_data, 'keys'):
                        description = str(item_data.get('description', '')).strip()
                        quantity = int(item_data.get('quantity', 1))
                        unit_price = float(item_data.get('unit_price', 0))
                        
                        if description:  # Only create if description is not empty
                            RequestItem.objects.create(
                                purchase_request=purchase_request,
                                description=description,
                                quantity=quantity,
                                unit_price=unit_price
                            )
                            logger.info(f"Created item: {description}, qty: {quantity}, price: {unit_price}")
                        else:
                            logger.warning(f"Skipping item with empty description: {item_data}")
                    else:
                        logger.warning(f"Skipping item - not a dict: {type(item_data)}")
                except Exception as e:
                    # Log error but continue with other items
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error creating item: {e}, item_data: {item_data}", exc_info=True)
                    continue
        
        return purchase_request


class PurchaseRequestUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating PurchaseRequest (only if pending)."""
    request_type_id = serializers.UUIDField(required=False)
    items = ItemsField(required=False, allow_null=True)
    
    class Meta:
        model = PurchaseRequest
        fields = [
            'title', 'description', 'amount', 'request_type_id', 'proforma', 'items'
        ]
    
    def to_internal_value(self, data):
        """Handle items as JSON string from multipart/form-data."""
        # Parse items before validation
        if 'items' in data:
            items_value = data.get('items')
            
            # Use our custom field to parse items
            items_field = ItemsField()
            try:
                parsed_items = items_field.to_internal_value(items_value)
                data = data.copy()
                data['items'] = parsed_items
            except Exception as e:
                # If parsing fails, set to empty list
                data = data.copy()
                data['items'] = []
        else:
            data = data.copy()
        
        return super().to_internal_value(data)
    
    def validate(self, attrs):
        """Validate that request can be edited."""
        if self.instance and not self.instance.can_be_edited:
            raise serializers.ValidationError(
                "Cannot edit request that is not in pending status."
            )
        return attrs
    
    def update(self, instance, validated_data):
        """Update purchase request and items."""
        items_data = validated_data.pop('items', None)
        request_type_id = validated_data.pop('request_type_id', None)
        
        # Update request type if provided
        if request_type_id:
            try:
                request_type = RequestType.objects.get(id=request_type_id, is_active=True)
                instance.request_type = request_type
            except RequestType.DoesNotExist:
                raise serializers.ValidationError({"request_type_id": "Request type does not exist or is not active."})
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update items if provided
        if items_data is not None:
            # Delete existing items
            instance.items.all().delete()
            # Create new items
            for item_data in items_data:
                try:
                    # Convert OrderedDict to dict if needed, or use directly
                    if hasattr(item_data, 'keys'):
                        # It's a dict-like object (OrderedDict, dict, etc.)
                        RequestItem.objects.create(
                            purchase_request=instance,
                            description=str(item_data.get('description', '')),
                            quantity=int(item_data.get('quantity', 1)),
                            unit_price=float(item_data.get('unit_price', 0))
                        )
                    elif isinstance(item_data, str):
                        # If it's still a string, try to parse it
                        import json
                        item_dict = json.loads(item_data)
                        RequestItem.objects.create(
                            purchase_request=instance,
                            description=str(item_dict.get('description', '')),
                            quantity=int(item_dict.get('quantity', 1)),
                            unit_price=float(item_dict.get('unit_price', 0))
                        )
                except Exception as e:
                    print(f"Error creating item: {e}, item_data: {item_data}")
                    continue
        
        return instance


class ApprovalActionSerializer(serializers.Serializer):
    """Serializer for approval/rejection actions."""
    comments = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        fields = ['comments']


class ReceiptSubmissionSerializer(serializers.Serializer):
    """Serializer for receipt submission."""
    receipt = serializers.FileField(required=True)
    
    class Meta:
        fields = ['receipt']
    
    def validate_receipt(self, value):
        """Validate receipt file."""
        if value:
            # Check file size
            if value.size > settings.MAX_UPLOAD_SIZE:
                raise serializers.ValidationError(
                    f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
                )
            
            # Check file type
            file_ext = value.name.split('.')[-1].lower()
            if file_ext not in settings.ALLOWED_FILE_TYPES:
                raise serializers.ValidationError(
                    f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_FILE_TYPES)}"
                )
        
        return value

