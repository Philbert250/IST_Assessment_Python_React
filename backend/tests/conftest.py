"""
Pytest configuration and shared fixtures.
"""
import pytest
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.test import APIClient
from procurement.models import (
    UserProfile, RequestType, ApprovalLevel, 
    PurchaseRequest, RequestItem, Approval
)

User = get_user_model()


@pytest.fixture
def api_client():
    """API client for making requests."""
    return APIClient()


@pytest.fixture
def db_with_rollback(db):
    """Database fixture with rollback support."""
    yield
    transaction.rollback()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    user = User.objects.create_user(
        username='staff_user',
        email='staff@example.com',
        password='testpass123'
    )
    UserProfile.objects.create(
        user=user,
        role='staff',
        department='IT'
    )
    return user


@pytest.fixture
def approver_level_1_user(db):
    """Create an approver level 1 user."""
    user = User.objects.create_user(
        username='approver1',
        email='approver1@example.com',
        password='testpass123'
    )
    UserProfile.objects.create(
        user=user,
        role='approver_level_1',
        department='Management'
    )
    return user


@pytest.fixture
def approver_level_2_user(db):
    """Create an approver level 2 user."""
    user = User.objects.create_user(
        username='approver2',
        email='approver2@example.com',
        password='testpass123'
    )
    UserProfile.objects.create(
        user=user,
        role='approver_level_2',
        department='Management'
    )
    return user


@pytest.fixture
def finance_user(db):
    """Create a finance user."""
    user = User.objects.create_user(
        username='finance_user',
        email='finance@example.com',
        password='testpass123'
    )
    UserProfile.objects.create(
        user=user,
        role='finance',
        department='Finance'
    )
    return user


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    user = User.objects.create_user(
        username='admin_user',
        email='admin@example.com',
        password='testpass123',
        is_staff=True,
        is_superuser=True
    )
    UserProfile.objects.create(
        user=user,
        role='admin',
        department='Administration'
    )
    return user


@pytest.fixture
def authenticated_staff_client(api_client, staff_user):
    """Authenticated API client with staff user."""
    api_client.force_authenticate(user=staff_user)
    return api_client


@pytest.fixture
def authenticated_approver1_client(api_client, approver_level_1_user):
    """Authenticated API client with approver level 1 user."""
    api_client.force_authenticate(user=approver_level_1_user)
    return api_client


@pytest.fixture
def authenticated_approver2_client(api_client, approver_level_2_user):
    """Authenticated API client with approver level 2 user."""
    api_client.force_authenticate(user=approver_level_2_user)
    return api_client


@pytest.fixture
def authenticated_finance_client(api_client, finance_user):
    """Authenticated API client with finance user."""
    api_client.force_authenticate(user=finance_user)
    return api_client


@pytest.fixture
def authenticated_admin_client(api_client, admin_user):
    """Authenticated API client with admin user."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def request_type(db):
    """Create a request type."""
    return RequestType.objects.create(
        name='Office Supplies',
        description='Office supplies and equipment',
        is_active=True
    )


@pytest.fixture
def approval_level_1(db, request_type):
    """Create approval level 1."""
    return ApprovalLevel.objects.create(
        request_type=request_type,
        level_number=1,
        approver_role='approver_level_1',
        is_required=True
    )


@pytest.fixture
def approval_level_2(db, request_type):
    """Create approval level 2."""
    return ApprovalLevel.objects.create(
        request_type=request_type,
        level_number=2,
        approver_role='approver_level_2',
        is_required=True
    )


@pytest.fixture
def purchase_request(db, staff_user, request_type):
    """Create a purchase request."""
    return PurchaseRequest.objects.create(
        title='Test Request',
        description='Test description',
        amount='1000.00',
        status='pending',
        created_by=staff_user,
        request_type=request_type
    )


@pytest.fixture
def request_item(db, purchase_request):
    """Create a request item."""
    return RequestItem.objects.create(
        purchase_request=purchase_request,
        description='Test Item',
        quantity=5,
        unit_price='200.00'
    )

