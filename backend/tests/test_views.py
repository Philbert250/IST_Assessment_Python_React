"""
Tests for API views and endpoints.
"""
import pytest
from rest_framework import status
from procurement.models import PurchaseRequest, RequestItem, Approval


class TestPurchaseRequestEndpoints:
    """Tests for PurchaseRequest API endpoints."""
    
    def test_create_purchase_request(self, authenticated_staff_client, request_type):
        """Test creating a purchase request."""
        data = {
            'title': 'New Request',
            'description': 'Test description',
            'amount': '500.00',
            'request_type_id': str(request_type.id)
        }
        response = authenticated_staff_client.post('/api/requests/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == 'New Request'
        assert response.data['status'] == 'pending'
    
    def test_create_purchase_request_unauthenticated(self, api_client, request_type):
        """Test creating request without authentication."""
        data = {
            'title': 'New Request',
            'description': 'Test description',
            'amount': '500.00',
            'request_type_id': str(request_type.id)
        }
        response = api_client.post('/api/requests/', data, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_list_purchase_requests(self, authenticated_staff_client, purchase_request):
        """Test listing purchase requests."""
        response = authenticated_staff_client.get('/api/requests/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
    
    def test_get_purchase_request_detail(self, authenticated_staff_client, purchase_request):
        """Test getting purchase request details."""
        response = authenticated_staff_client.get(f'/api/requests/{purchase_request.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(purchase_request.id)
        assert response.data['title'] == purchase_request.title
    
    def test_update_purchase_request(self, authenticated_staff_client, purchase_request):
        """Test updating a purchase request."""
        data = {
            'title': 'Updated Request',
            'description': 'Updated description',
            'amount': '1500.00'
        }
        response = authenticated_staff_client.patch(
            f'/api/requests/{purchase_request.id}/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Updated Request'
    
    def test_cannot_update_approved_request(self, authenticated_staff_client, purchase_request):
        """Test that approved requests cannot be updated."""
        purchase_request.status = 'approved'
        purchase_request.save()
        
        data = {'title': 'Updated Request'}
        response = authenticated_staff_client.patch(
            f'/api/requests/{purchase_request.id}/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestApprovalEndpoints:
    """Tests for approval/rejection endpoints."""
    
    def test_approve_request(self, authenticated_approver1_client, purchase_request, approval_level_1):
        """Test approving a purchase request."""
        data = {'comments': 'Looks good'}
        response = authenticated_approver1_client.patch(
            f'/api/requests/{purchase_request.id}/approve/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        
        # Check approval was created
        approval = Approval.objects.filter(
            purchase_request=purchase_request,
            approver=authenticated_approver1_client.handler._force_user
        ).first()
        assert approval is not None
        assert approval.action == 'approved'
    
    def test_reject_request(self, authenticated_approver1_client, purchase_request, approval_level_1):
        """Test rejecting a purchase request."""
        data = {'comments': 'Not approved'}
        response = authenticated_approver1_client.patch(
            f'/api/requests/{purchase_request.id}/reject/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        
        # Check request status is rejected
        purchase_request.refresh_from_db()
        assert purchase_request.status == 'rejected'
    
    def test_staff_cannot_approve(self, authenticated_staff_client, purchase_request):
        """Test that staff cannot approve requests."""
        data = {'comments': 'Test'}
        response = authenticated_staff_client.patch(
            f'/api/requests/{purchase_request.id}/approve/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_cannot_approve_final_status(self, authenticated_approver1_client, purchase_request):
        """Test that approved/rejected requests cannot be approved again."""
        purchase_request.status = 'approved'
        purchase_request.save()
        
        data = {'comments': 'Test'}
        response = authenticated_approver1_client.patch(
            f'/api/requests/{purchase_request.id}/approve/',
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestRequestItemEndpoints:
    """Tests for request items in purchase requests."""
    
    def test_create_request_with_items(self, authenticated_staff_client, request_type):
        """Test creating a request with items."""
        import json
        items = [
            {
                'description': 'Item 1',
                'quantity': 5,
                'unit_price': '100.00'
            },
            {
                'description': 'Item 2',
                'quantity': 3,
                'unit_price': '200.00'
            }
        ]
        data = {
            'title': 'Request with Items',
            'description': 'Test',
            'amount': '1100.00',
            'request_type_id': str(request_type.id),
            'items': json.dumps(items)
        }
        response = authenticated_staff_client.post('/api/requests/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check items were created
        request_id = response.data['id']
        request = PurchaseRequest.objects.get(id=request_id)
        assert request.items.count() == 2


class TestPermissions:
    """Tests for role-based permissions."""
    
    def test_staff_can_create_request(self, authenticated_staff_client, request_type):
        """Test staff can create requests."""
        data = {
            'title': 'Staff Request',
            'description': 'Test',
            'amount': '500.00',
            'request_type_id': str(request_type.id)
        }
        response = authenticated_staff_client.post('/api/requests/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_approver_can_view_requests(self, authenticated_approver1_client, purchase_request):
        """Test approvers can view requests."""
        response = authenticated_approver1_client.get('/api/requests/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_finance_can_view_approved_requests(self, authenticated_finance_client, purchase_request):
        """Test finance can view requests."""
        purchase_request.status = 'approved'
        purchase_request.save()
        
        response = authenticated_finance_client.get('/api/requests/')
        assert response.status_code == status.HTTP_200_OK

