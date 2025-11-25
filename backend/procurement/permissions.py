from rest_framework import permissions
from .models import UserProfile


class IsStaff(permissions.BasePermission):
    """Permission check for Staff role. Superusers have all permissions."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers have all permissions
        if request.user.is_superuser:
            return True
        try:
            profile = request.user.profile
            return profile.role == 'staff'
        except UserProfile.DoesNotExist:
            return False


class IsApproverLevel1(permissions.BasePermission):
    """Permission check for Approver Level 1 role."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            profile = request.user.profile
            return profile.role == 'approver_level_1'
        except UserProfile.DoesNotExist:
            return False


class IsApproverLevel2(permissions.BasePermission):
    """Permission check for Approver Level 2 role."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            profile = request.user.profile
            return profile.role == 'approver_level_2'
        except UserProfile.DoesNotExist:
            return False


class IsFinance(permissions.BasePermission):
    """Permission check for Finance role. Superusers have all permissions."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers have all permissions
        if request.user.is_superuser:
            return True
        try:
            profile = request.user.profile
            return profile.role == 'finance'
        except UserProfile.DoesNotExist:
            return False


class IsApprover(permissions.BasePermission):
    """Permission check for any Approver role (Level 1 or Level 2). Superusers have all permissions."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers have all permissions
        if request.user.is_superuser:
            return True
        try:
            profile = request.user.profile
            return profile.role in ['approver_level_1', 'approver_level_2']
        except UserProfile.DoesNotExist:
            return False


class IsStaffOrFinance(permissions.BasePermission):
    """Permission check for Staff or Finance role. Superusers have all permissions."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers have all permissions
        if request.user.is_superuser:
            return True
        try:
            profile = request.user.profile
            return profile.role in ['staff', 'finance']
        except UserProfile.DoesNotExist:
            return False


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to edit it.
    Assumes the model instance has a `created_by` attribute.
    """
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        return False


class IsAdmin(permissions.BasePermission):
    """Permission check for Admin role or superuser."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers have admin permissions
        if request.user.is_superuser:
            return True
        try:
            profile = request.user.profile
            return profile.role == 'admin'
        except UserProfile.DoesNotExist:
            return False

