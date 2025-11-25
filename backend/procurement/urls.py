from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'procurement'

# Create router for ViewSets
router = DefaultRouter()
router.register(r'requests', views.PurchaseRequestViewSet, basename='purchaserequest')
router.register(r'request-types', views.RequestTypeViewSet, basename='requesttype')
router.register(r'approval-levels', views.ApprovalLevelViewSet, basename='approvallevel')
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # Health check endpoint
    path('health/', views.health_check, name='health_check'),
    
    # Authentication endpoints
    path('auth/register/', views.register, name='register'),
    path('auth/me/', views.current_user, name='current_user'),
    path('auth/profile/', views.UserProfileView.as_view(), name='user_profile'),
    path('auth/user/', views.UserDetailView.as_view(), name='user_detail'),
    
    # Include router URLs
    path('', include(router.urls)),
]

