"""
Tests for procurement models.
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from procurement.models import (
    UserProfile, RequestType, ApprovalLevel,
    PurchaseRequest, RequestItem, Approval
)

User = get_user_model()


class TestUserProfile:
    """Tests for UserProfile model."""
    
    def test_create_user_profile(self, db):
        """Test creating a user profile."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        profile = UserProfile.objects.create(
            user=user,
            role='staff',
            department='IT'
        )
        assert profile.user == user
        assert profile.role == 'staff'
        assert profile.department == 'IT'
    
    def test_user_profile_str(self, db, staff_user):
        """Test UserProfile string representation."""
        profile = staff_user.profile
        assert str(profile) == f"{staff_user.username} - Staff"
    
    def test_role_choices(self, db):
        """Test role choices are valid."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        # Valid role
        profile = UserProfile.objects.create(
            user=user,
            role='staff'
        )
        assert profile.role == 'staff'
        
        # Invalid role should raise error
        with pytest.raises(ValidationError):
            profile.role = 'invalid_role'
            profile.full_clean()


class TestRequestType:
    """Tests for RequestType model."""
    
    def test_create_request_type(self, db):
        """Test creating a request type."""
        request_type = RequestType.objects.create(
            name='Office Supplies',
            description='Office supplies and equipment',
            is_active=True
        )
        assert request_type.name == 'Office Supplies'
        assert request_type.is_active is True
    
    def test_request_type_str(self, db, request_type):
        """Test RequestType string representation."""
        assert str(request_type) == 'Office Supplies'


class TestApprovalLevel:
    """Tests for ApprovalLevel model."""
    
    def test_create_approval_level(self, db, request_type):
        """Test creating an approval level."""
        level = ApprovalLevel.objects.create(
            request_type=request_type,
            level_number=1,
            approver_role='approver_level_1',
            is_required=True
        )
        assert level.level_number == 1
        assert level.approver_role == 'approver_level_1'
        assert level.is_required is True
    
    def test_approval_level_str(self, db, approval_level_1):
        """Test ApprovalLevel string representation."""
        assert 'Level 1' in str(approval_level_1)


class TestPurchaseRequest:
    """Tests for PurchaseRequest model."""
    
    def test_create_purchase_request(self, db, staff_user, request_type):
        """Test creating a purchase request."""
        request = PurchaseRequest.objects.create(
            title='Test Request',
            description='Test description',
            amount='1000.00',
            status='pending',
            created_by=staff_user,
            request_type=request_type
        )
        assert request.title == 'Test Request'
        assert request.status == 'pending'
        assert request.created_by == staff_user
    
    def test_purchase_request_str(self, db, purchase_request):
        """Test PurchaseRequest string representation."""
        assert 'Test Request' in str(purchase_request)
        assert 'Pending' in str(purchase_request)
    
    def test_can_be_edited_property(self, db, purchase_request):
        """Test can_be_edited property."""
        # Pending request can be edited
        purchase_request.status = 'pending'
        purchase_request.save()
        assert purchase_request.can_be_edited is True
        
        # Approved request cannot be edited
        purchase_request.status = 'approved'
        purchase_request.save()
        assert purchase_request.can_be_edited is False
    
    def test_is_final_status_property(self, db, purchase_request):
        """Test is_final_status property."""
        # Pending is not final
        purchase_request.status = 'pending'
        purchase_request.save()
        assert purchase_request.is_final_status is False
        
        # Approved is final
        purchase_request.status = 'approved'
        purchase_request.save()
        assert purchase_request.is_final_status is True
        
        # Rejected is final
        purchase_request.status = 'rejected'
        purchase_request.save()
        assert purchase_request.is_final_status is True


class TestRequestItem:
    """Tests for RequestItem model."""
    
    def test_create_request_item(self, db, purchase_request):
        """Test creating a request item."""
        from decimal import Decimal
        item = RequestItem.objects.create(
            purchase_request=purchase_request,
            description='Test Item',
            quantity=5,
            unit_price='200.00'
        )
        assert item.description == 'Test Item'
        assert item.quantity == 5
        # Django DecimalField returns string representation, so compare as strings
        assert str(item.unit_price) == '200.00'
        assert item.total_price == Decimal('1000.00')  # 5 * 200.00
    
    def test_total_price_calculation(self, db, purchase_request):
        """Test total_price is calculated correctly."""
        from decimal import Decimal
        item = RequestItem.objects.create(
            purchase_request=purchase_request,
            description='Test Item',
            quantity=10,
            unit_price='150.00'
        )
        assert item.total_price == Decimal('1500.00')  # 10 * 150.00


class TestApproval:
    """Tests for Approval model."""
    
    def test_create_approval(self, db, purchase_request, approver_level_1_user, approval_level_1):
        """Test creating an approval."""
        approval = Approval.objects.create(
            purchase_request=purchase_request,
            approver=approver_level_1_user,
            approval_level=approval_level_1,
            action='approved'
        )
        assert approval.action == 'approved'
        assert approval.approver == approver_level_1_user
    
    def test_approval_str(self, db, purchase_request, approver_level_1_user, approval_level_1):
        """Test Approval string representation."""
        approval = Approval.objects.create(
            purchase_request=purchase_request,
            approver=approver_level_1_user,
            approval_level=approval_level_1,
            action='approved'
        )
        assert 'approved' in str(approval).lower()

