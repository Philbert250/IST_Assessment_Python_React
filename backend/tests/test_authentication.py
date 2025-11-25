"""
Tests for authentication endpoints.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()


class TestAuthentication:
    """Tests for authentication endpoints."""
    
    def test_register_user(self, api_client, db):
        """Test user registration."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'testpass123',
            'password_confirm': 'testpass123',
            'role': 'staff',
            'first_name': 'New',
            'last_name': 'User'
        }
        response = api_client.post('/api/auth/register/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert 'user' in response.data
        assert response.data['user']['username'] == 'newuser'
    
    def test_register_user_password_mismatch(self, api_client, db):
        """Test registration fails with password mismatch."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'testpass123',
            'password_confirm': 'differentpass',
            'role': 'staff'
        }
        response = api_client.post('/api/auth/register/', data, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_login_success(self, api_client, staff_user):
        """Test successful login."""
        data = {
            'username': 'staff_user',
            'password': 'testpass123'
        }
        response = api_client.post('/api/token/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data
    
    def test_login_invalid_credentials(self, api_client, db):
        """Test login with invalid credentials."""
        data = {
            'username': 'nonexistent',
            'password': 'wrongpassword'
        }
        response = api_client.post('/api/token/', data, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user(self, authenticated_staff_client, staff_user):
        """Test getting current user info."""
        response = authenticated_staff_client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == 'staff_user'
        assert response.data['role'] == 'staff'
    
    def test_get_current_user_unauthenticated(self, api_client):
        """Test getting current user without authentication."""
        response = api_client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_refresh_token(self, api_client, staff_user):
        """Test token refresh."""
        # First, get tokens
        login_data = {
            'username': 'staff_user',
            'password': 'testpass123'
        }
        login_response = api_client.post('/api/token/', login_data, format='json')
        refresh_token = login_response.data['refresh']
        
        # Refresh the token
        refresh_data = {'refresh': refresh_token}
        response = api_client.post('/api/token/refresh/', refresh_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data

