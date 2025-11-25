"""
Tests for custom permissions.
"""
import pytest
from rest_framework import status
from procurement.permissions import IsStaff, IsApprover, IsFinance, IsAdmin


class TestPermissionClasses:
    """Tests for custom permission classes."""
    
    def test_staff_permission(self, authenticated_staff_client, request_type):
        """Test that staff can create requests."""
        data = {
            'title': 'Staff Request',
            'description': 'Test',
            'amount': '500.00',
            'request_type_id': str(request_type.id)
        }
        response = authenticated_staff_client.post('/api/requests/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_approver_permission(self, authenticated_approver1_client, purchase_request, approval_level_1):
        """Test that approvers can approve requests."""
        data = {'comments': 'Approved'}
        response = authenticated_approver1_client.patch(
            f'/api/requests/{purchase_request.id}/approve/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
    
    def test_finance_permission(self, authenticated_finance_client, purchase_request):
        """Test that finance can view requests."""
        response = authenticated_finance_client.get('/api/requests/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_admin_permission(self, authenticated_admin_client):
        """Test that admin can access admin endpoints."""
        response = authenticated_admin_client.get('/api/users/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_unauthorized_access(self, api_client):
        """Test that unauthenticated users cannot access protected endpoints."""
        response = api_client.get('/api/requests/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

