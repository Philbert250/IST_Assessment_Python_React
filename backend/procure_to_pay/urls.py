"""
URL configuration for procure_to_pay project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import Http404
from rest_framework_simplejwt.views import TokenRefreshView
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from procurement.views import CustomTokenObtainPairView, health_check

# Determine the server URL based on environment
def get_server_url():
    """Get the server URL for Swagger/OpenAPI schema."""
    if not settings.DEBUG:
        # Production: use HTTPS
        return 'https://procure-to-pay-backend-philbert.fly.dev'
    else:
        # Development: use localhost
        return 'http://localhost:8000'

schema_view = get_schema_view(
   openapi.Info(
      title="Procure-to-Pay API",
      default_version='v1',
      description="""
      API documentation for Procure-to-Pay system.
      
      ## Authentication
      This API uses JWT (JSON Web Token) authentication. To authenticate:
      1. Register a new user at `/api/auth/register/`
      2. Obtain a token at `/api/token/` using your username and password
      3. Click the "Authorize" button above and enter: `Bearer <your_token>`
      4. Or use the token in the Authorization header: `Bearer <your_token>`
      
      ## Roles
      - **Staff**: Can create and manage their own purchase requests
      - **Approver Level 1**: Can approve/reject requests at level 1
      - **Approver Level 2**: Can approve/reject requests at level 2
      - **Finance**: Can view and interact with all requests
      """,
      terms_of_service="https://www.google.com/policies/terms/",
      contact=openapi.Contact(email="contact@procuretopay.local"),
      license=openapi.License(name="BSD License"),
   ),
   url=get_server_url(),
   public=True,
   permission_classes=[],
   authentication_classes=[],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Health check (at root level for easier access)
    path('health/', health_check, name='health_check'),
    
    # JWT Authentication
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API endpoints
    path('api/', include('procurement.urls')),
    
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# Serve static files in production (for Swagger UI, admin, etc.)
if not settings.DEBUG:
    from django.views.decorators.cache import never_cache
    
    def serve_static(request, path):
        """Serve static files in production."""
        try:
            return serve(request, path, document_root=settings.STATIC_ROOT)
        except Http404:
            raise Http404("Static file not found")
    
    # Serve static files - remove leading slash from STATIC_URL for path matching
    static_url = settings.STATIC_URL.lstrip('/')
    urlpatterns += [
        path(f'{static_url}<path:path>', never_cache(serve_static), name='static'),
    ]

# Serve media files (only if not using S3)
# When using S3, files are served directly from S3, not through Django
if not getattr(settings, 'USE_S3', False):
    if settings.DEBUG:
        # Development: use Django's static file serving
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
        urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    else:
        # Production: serve media files through Django view
        # This allows media files to be served even when DEBUG=False
        from django.views.decorators.cache import never_cache
        
        def serve_media(request, path):
            """Serve media files in production."""
            try:
                return serve(request, path, document_root=settings.MEDIA_ROOT)
            except Http404:
                raise Http404("Media file not found")
        
        # Serve media files - allow unauthenticated access for public files
        # Remove leading slash from MEDIA_URL for path matching
        media_url = settings.MEDIA_URL.lstrip('/')
        urlpatterns += [
            path(f'{media_url}<path:path>', never_cache(serve_media), name='media'),
        ]

