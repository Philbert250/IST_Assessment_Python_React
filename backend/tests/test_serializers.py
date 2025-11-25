"""
Tests for serializers.
"""
import pytest
from procurement.serializers import (
    UserRegistrationSerializer, PurchaseRequestCreateSerializer,
    PurchaseRequestDetailSerializer, ApprovalSerializer
)
from procurement.models import PurchaseRequest, RequestType


class TestUserRegistrationSerializer:
    """Tests for UserRegistrationSerializer."""
    
    def test_valid_registration_data(self, db, request_type):
        """Test serializer with valid data."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'testpass123',
            'password_confirm': 'testpass123',
            'role': 'staff',
            'first_name': 'New',
            'last_name': 'User'
        }
        serializer = UserRegistrationSerializer(data=data)
        assert serializer.is_valid() is True
    
    def test_password_mismatch(self, db):
        """Test serializer rejects mismatched passwords."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'testpass123',
            'password_confirm': 'differentpass',
            'role': 'staff'
        }
        serializer = UserRegistrationSerializer(data=data)
        assert serializer.is_valid() is False
        assert 'password' in serializer.errors or 'non_field_errors' in serializer.errors


class TestPurchaseRequestCreateSerializer:
    """Tests for PurchaseRequestCreateSerializer."""
    
    def test_valid_create_data(self, db, request_type, staff_user):
        """Test serializer with valid data."""
        data = {
            'title': 'Test Request',
            'description': 'Test description',
            'amount': '1000.00',
            'request_type_id': str(request_type.id)
        }
        serializer = PurchaseRequestCreateSerializer(
            data=data,
            context={'request': type('obj', (object,), {'user': staff_user})()}
        )
        assert serializer.is_valid() is True
    
    def test_missing_required_fields(self, db):
        """Test serializer requires all fields."""
        data = {
            'title': 'Test Request'
        }
        serializer = PurchaseRequestCreateSerializer(data=data)
        assert serializer.is_valid() is False
        assert 'request_type_id' in serializer.errors


class TestPurchaseRequestDetailSerializer:
    """Tests for PurchaseRequestDetailSerializer."""
    
    def test_serialize_purchase_request(self, purchase_request):
        """Test serializing a purchase request."""
        serializer = PurchaseRequestDetailSerializer(purchase_request)
        data = serializer.data
        
        assert data['id'] == str(purchase_request.id)
        assert data['title'] == purchase_request.title
        assert data['status'] == purchase_request.status
        assert 'created_by_username' in data
        assert 'request_type' in data
    
    def test_read_only_fields(self, purchase_request):
        """Test that read-only fields are present."""
        serializer = PurchaseRequestDetailSerializer(purchase_request)
        data = serializer.data
        
        assert 'id' in data
        assert 'created_at' in data
        assert 'updated_at' in data
        assert 'can_be_edited' in data
        assert 'is_final_status' in data

