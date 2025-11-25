from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid


class UserProfile(models.Model):
    """
    Extended user profile with role information.
    """
    ROLE_CHOICES = [
        ('staff', 'Staff'),
        ('approver_level_1', 'Approver Level 1'),
        ('approver_level_2', 'Approver Level 2'),
        ('finance', 'Finance'),
    ]
    DEPARTMENT_CHOICES = [
        ('it', 'IT'),
        ('finance', 'Finance'),
        ('hr', 'HR'),
        ('marketing', 'Marketing'),
        ('sales', 'Sales'),
        ('customer_service', 'Customer Service'),
        ('other', 'Other'),
    ]

    # UUID field
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True, choices=DEPARTMENT_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
    
    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"


class RequestType(models.Model):
    """
    Configurable request types (e.g., Office Supplies, Equipment, Services).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Request Type"
        verbose_name_plural = "Request Types"
        ordering = ['name']


class ApprovalLevel(models.Model):
    """
    Configurable approval levels for each request type.
    Defines how many approval levels are required for a request type.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_type = models.ForeignKey(
        RequestType,
        on_delete=models.CASCADE,
        related_name='approval_levels'
    )
    level_number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    approver_role = models.CharField(
        max_length=20,
        choices=UserProfile.ROLE_CHOICES,
        help_text="Role required to approve at this level"
    )
    is_required = models.BooleanField(
        default=True,
        help_text="Whether this level is required for approval"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Approval Level"
        verbose_name_plural = "Approval Levels"
        unique_together = ['request_type', 'level_number']
        ordering = ['request_type', 'level_number']
    
    def __str__(self):
        return f"{self.request_type.name} - Level {self.level_number} ({self.approver_role})"


class PurchaseRequest(models.Model):
    """
    Main purchase request model.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField()
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Relationships
    request_type = models.ForeignKey(
        RequestType,
        on_delete=models.PROTECT,
        related_name='purchase_requests'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_requests'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approved_requests',
        blank=True,
        null=True,
        help_text="User who finally approved this request"
    )
    
    # File uploads
    proforma = models.FileField(
        upload_to='proformas/',
        blank=True,
        null=True,
        help_text="Proforma invoice document"
    )
    purchase_order = models.FileField(
        upload_to='purchase_orders/',
        blank=True,
        null=True,
        help_text="Generated purchase order document"
    )
    receipt = models.FileField(
        upload_to='receipts/',
        blank=True,
        null=True,
        help_text="Receipt document"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    
    # Receipt validation
    receipt_validated = models.BooleanField(default=False)
    receipt_validation_notes = models.TextField(blank=True, null=True)
    
    # Extracted data from documents (stored as JSON)
    proforma_extracted_data = models.JSONField(blank=True, null=True, help_text="Extracted data from proforma invoice")
    
    class Meta:
        verbose_name = "Purchase Request"
        verbose_name_plural = "Purchase Requests"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['created_by', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.get_status_display()} ({self.amount})"
    
    @property
    def can_be_edited(self):
        """Check if request can be edited (only if pending)."""
        return self.status == 'pending'
    
    @property
    def is_final_status(self):
        """Check if request is in final status (approved or rejected)."""
        return self.status in ['approved', 'rejected']
    
    @property
    def final_approver(self):
        """Get the final approver (last person who approved)."""
        if self.status == 'approved':
            last_approval = self.approvals.filter(action='approved').order_by('-created_at').first()
            return last_approval.approver if last_approval else None
        return None


class RequestItem(models.Model):
    """
    Optional line items for purchase requests.
    """
    purchase_request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.CASCADE,
        related_name='items'
    )
    description = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Request Item"
        verbose_name_plural = "Request Items"
        ordering = ['id']
    
    def __str__(self):
        return f"{self.description} - {self.quantity} x {self.unit_price}"
    
    def save(self, *args, **kwargs):
        """Auto-calculate total_price."""
        from decimal import Decimal
        # Ensure we're working with Decimal types
        quantity = Decimal(str(self.quantity))
        unit_price = Decimal(str(self.unit_price))
        self.total_price = quantity * unit_price
        super().save(*args, **kwargs)


class Approval(models.Model):
    """
    Tracks approval history for purchase requests.
    Supports parallel approvals with concurrency safety.
    """
    ACTION_CHOICES = [
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.CASCADE,
        related_name='approvals'
    )
    approver = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approvals'
    )
    approval_level = models.ForeignKey(
        ApprovalLevel,
        on_delete=models.PROTECT,
        related_name='approvals'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    rejected_at = models.DateTimeField(blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='cancelled_approvals',
        blank=True,
        null=True
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_approvals',
        blank=True,
        null=True
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='updated_approvals',
        blank=True,
        null=True
    )
    class Meta:
        verbose_name = "Approval"
        verbose_name_plural = "Approvals"
        ordering = ['-created_at']
        unique_together = ['purchase_request', 'approval_level', 'approver']
        indexes = [
            models.Index(fields=['purchase_request', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.purchase_request.title} - {self.get_action_display()} by {self.approver.username}"


# Signal to update purchase request status on rejection
@receiver(post_save, sender=Approval)
def update_purchase_request_status_on_rejection(sender, instance, created, **kwargs):
    """Update purchase request status when an approval is rejected."""
    if created and instance.action == 'rejected' and instance.purchase_request_id:
        PurchaseRequest.objects.filter(pk=instance.purchase_request_id).update(status='rejected')

