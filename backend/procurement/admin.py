from typing import Literal
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    UserProfile,
    RequestType,
    ApprovalLevel,
    PurchaseRequest,
    RequestItem,
    Approval,
)


# Inline admin for UserProfile
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fk_name = 'user'


# Extend User Admin to include UserProfile
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    
    def get_inline_instances(self, request, obj=None):
        if not obj:
            return list()
        return super().get_inline_instances(request, obj)


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'department', 'created_at')
    list_filter = ('role', 'department', 'created_at')
    search_fields = ('user__username', 'user__email', 'department')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Role Information', {
            'fields': ('role', 'department')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RequestType)
class RequestTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ApprovalLevel)
class ApprovalLevelAdmin(admin.ModelAdmin):
    list_display = ('request_type', 'level_number', 'approver_role', 'is_required', 'created_at')
    list_filter = ('request_type', 'approver_role', 'is_required', 'created_at')
    search_fields = ('request_type__name',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Configuration', {
            'fields': ('request_type', 'level_number', 'approver_role', 'is_required')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# Inline admin for RequestItem
class RequestItemInline(admin.TabularInline):
    model = RequestItem
    extra = 1
    fields = ('description', 'quantity', 'unit_price', 'total_price')
    readonly_fields = ('total_price',)


# Inline admin for Approval
class ApprovalInline(admin.TabularInline):
    model = Approval
    extra = 0
    readonly_fields = ('approver', 'approval_level', 'action', 'comments', 'created_at')
    can_delete = False
    fields = ('approver', 'approval_level', 'action', 'comments', 'created_at')
    
    def has_add_permission(self, request, obj=None):
        return False  # Approvals should be created through API, not admin


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'request_type', 'created_by', 'approved_by', 'amount', 'status', 'created_at')
    list_filter = ('status', 'request_type', 'created_at', 'receipt_validated')
    search_fields = ('title', 'description', 'created_by__username')
    readonly_fields = ('id', 'created_at', 'updated_at', 'submitted_at', 'can_be_edited', 'is_final_status', 'proforma_extracted_data_display')
    date_hierarchy = 'created_at'
    inlines = [RequestItemInline, ApprovalInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'title', 'description', 'amount', 'status')
        }),
        ('Relationships', {
            'fields': ('request_type', 'created_by', 'approved_by')
        }),
        ('Documents', {
            'fields': ('proforma', 'purchase_order', 'receipt'),
            'classes': ('collapse',)
        }),
        ('Proforma Extracted Data', {
            'fields': ('proforma_extracted_data_display',),
            'classes': ('collapse',)
        }),
        ('Receipt Validation', {
            'fields': ('receipt_validated', 'receipt_validation_notes'),
            'classes': ('collapse',)
        }),
        ('Status Information', {
            'fields': ('can_be_edited', 'is_final_status'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'submitted_at'),
            'classes': ('collapse',)
        }),
    )
    
    def proforma_extracted_data_display(self, obj):
        """Display proforma extracted data in a readable format."""
        if obj.proforma_extracted_data:
            import json
            return json.dumps(obj.proforma_extracted_data, indent=2, ensure_ascii=False)
        return "No extracted data"
    proforma_extracted_data_display.short_description = 'Proforma Extracted Data'
    proforma_extracted_data_display.help_text = 'Data extracted from the proforma document using AI'
    
    def get_readonly_fields(self, request, obj=None):
        # Make status readonly if request is in final status
        readonly = list[Literal['id', 'created_at', 'updated_at', 'submitted_at', 'can_be_edited', 'is_final_status']](self.readonly_fields)
        if obj and obj.is_final_status:
            readonly.append('status')
        return readonly


@admin.register(RequestItem)
class RequestItemAdmin(admin.ModelAdmin):
    list_display = ('purchase_request', 'description', 'quantity', 'unit_price', 'total_price')
    list_filter = ('purchase_request__status', 'created_at')
    search_fields = ('description', 'purchase_request__title')
    readonly_fields = ('total_price', 'created_at')
    fieldsets = (
        ('Item Information', {
            'fields': ('purchase_request', 'description', 'quantity', 'unit_price', 'total_price')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ('purchase_request', 'approver', 'approval_level', 'action', 'created_at')
    list_filter = ('action', 'approval_level', 'created_at')
    search_fields = ('purchase_request__title', 'approver__username', 'comments')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Approval Information', {
            'fields': ('id', 'purchase_request', 'approver', 'approval_level', 'action', 'comments')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        # Approvals should be created through API, not admin
        return False
