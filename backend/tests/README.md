# Backend Tests

This directory contains pytest tests for the procurement backend.

## Running Tests

### Run all tests
```bash
cd backend
pytest
```

### Run with coverage
```bash
pytest --cov=procurement --cov-report=html
```

### Run specific test file
```bash
pytest tests/test_models.py
```

### Run specific test
```bash
pytest tests/test_models.py::TestUserProfile::test_create_user_profile
```

### Run with verbose output
```bash
pytest -v
```

## Test Structure

- `conftest.py` - Shared fixtures and configuration
- `test_models.py` - Model tests
- `test_views.py` - API endpoint tests
- `test_authentication.py` - Authentication and JWT tests
- `test_serializers.py` - Serializer validation tests
- `test_approval_workflow.py` - Approval workflow logic tests
- `test_permissions.py` - Permission class tests

## Test Database

Tests use an in-memory SQLite database for speed. This is configured in `settings.py` when pytest is detected.

## Fixtures

Common fixtures are defined in `conftest.py`:
- `staff_user` - Staff user with profile
- `approver_level_1_user` - Approver level 1 user
- `approver_level_2_user` - Approver level 2 user
- `finance_user` - Finance user
- `admin_user` - Admin user
- `request_type` - Request type fixture
- `approval_level_1` - Approval level 1 fixture
- `purchase_request` - Purchase request fixture
- `authenticated_staff_client` - Authenticated API client for staff
- And more...

## Coverage

To generate an HTML coverage report:
```bash
pytest --cov=procurement --cov-report=html
```

Then open `htmlcov/index.html` in your browser.

