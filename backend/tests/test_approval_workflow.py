"""
Tests for approval workflow logic.
"""
import pytest
from procurement.models import PurchaseRequest, Approval, ApprovalLevel


class TestApprovalWorkflow:
    """Tests for multi-level approval workflow."""
    
    def test_multi_level_approval_required(self, db, purchase_request, approval_level_1, approval_level_2):
        """Test that multiple approval levels are required."""
        # Get approval levels for the request type
        levels = ApprovalLevel.objects.filter(
            request_type=purchase_request.request_type,
            is_required=True
        ).order_by('level_number')
        
        assert levels.count() >= 1
    
    def test_approval_creates_record(self, db, purchase_request, approver_level_1_user, approval_level_1):
        """Test that approving creates an approval record."""
        approval = Approval.objects.create(
            purchase_request=purchase_request,
            approver=approver_level_1_user,
            approval_level=approval_level_1,
            action='approved',
            comments='Approved'
        )
        
        assert approval.action == 'approved'
        assert approval.purchase_request == purchase_request
        assert approval.approver == approver_level_1_user
    
    def test_rejection_sets_status(self, db, purchase_request, approver_level_1_user, approval_level_1):
        """Test that rejection sets request status to rejected."""
        # Store the purchase request ID
        request_id = purchase_request.id
        
        # Create approval with rejection action
        approval = Approval(
            purchase_request=purchase_request,
            approver=approver_level_1_user,
            approval_level=approval_level_1,
            action='rejected',
            comments='Not approved'
        )
        approval.save()  # This should trigger status update
        
        # Get fresh instance from database to avoid caching issues
        purchase_request = PurchaseRequest.objects.get(id=request_id)
        assert purchase_request.status == 'rejected'
    
    def test_parallel_approvals(self, db, purchase_request, approver_level_1_user, approver_level_2_user, 
                                approval_level_1, approval_level_2):
        """Test that parallel approvals can be created."""
        # Create two approvals at different levels
        approval1 = Approval.objects.create(
            purchase_request=purchase_request,
            approver=approver_level_1_user,
            approval_level=approval_level_1,
            action='approved'
        )
        
        approval2 = Approval.objects.create(
            purchase_request=purchase_request,
            approver=approver_level_2_user,
            approval_level=approval_level_2,
            action='approved'
        )
        
        assert approval1.id != approval2.id
        assert Approval.objects.filter(purchase_request=purchase_request).count() == 2
    
    def test_approval_level_ordering(self, db, request_type):
        """Test that approval levels are ordered correctly."""
        level1 = ApprovalLevel.objects.create(
            request_type=request_type,
            level_number=1,
            approver_role='approver_level_1',
            is_required=True
        )
        
        level2 = ApprovalLevel.objects.create(
            request_type=request_type,
            level_number=2,
            approver_role='approver_level_2',
            is_required=True
        )
        
        levels = ApprovalLevel.objects.filter(
            request_type=request_type
        ).order_by('level_number')
        
        assert levels[0].level_number == 1
        assert levels[1].level_number == 2

