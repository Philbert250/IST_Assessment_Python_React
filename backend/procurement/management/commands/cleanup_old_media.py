"""
Django management command to clean up old media files.
Removes orphaned files that are not referenced in the database.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from procurement.models import PurchaseRequest
import os
from pathlib import Path
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = 'Clean up old or orphaned media files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Delete files older than this many days (default: 90)',
        )
        parser.add_argument(
            '--orphaned-only',
            action='store_true',
            help='Only delete files not referenced in database',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        days = options['days']
        orphaned_only = options['orphaned_only']
        
        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            self.stdout.write(self.style.WARNING(f'Media root does not exist: {media_root}'))
            return
        
        # Get all referenced file paths from database
        referenced_files = set()
        
        # Get all proforma files
        for pr in PurchaseRequest.objects.exclude(proforma=''):
            if pr.proforma:
                referenced_files.add(pr.proforma.name)
        
        # Get all PO files
        for pr in PurchaseRequest.objects.exclude(purchase_order=''):
            if pr.purchase_order:
                referenced_files.add(pr.purchase_order.name)
        
        # Get all receipt files
        for pr in PurchaseRequest.objects.exclude(receipt=''):
            if pr.receipt:
                referenced_files.add(pr.receipt.name)
        
        self.stdout.write(f'Found {len(referenced_files)} referenced files in database')
        
        # Find all files in media directories
        deleted_count = 0
        deleted_size = 0
        cutoff_date = datetime.now() - timedelta(days=days)
        
        for subdir in ['proformas', 'purchase_orders', 'receipts']:
            subdir_path = media_root / subdir
            if not subdir_path.exists():
                continue
            
            self.stdout.write(f'\nChecking {subdir}/...')
            
            for file_path in subdir_path.iterdir():
                if not file_path.is_file():
                    continue
                
                file_name = f'{subdir}/{file_path.name}'
                file_size = file_path.stat().st_size
                file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                should_delete = False
                reason = ''
                
                if orphaned_only:
                    # Only delete if not referenced
                    if file_name not in referenced_files:
                        should_delete = True
                        reason = 'orphaned (not in database)'
                else:
                    # Delete if old OR orphaned
                    if file_name not in referenced_files:
                        should_delete = True
                        reason = 'orphaned (not in database)'
                    elif file_mtime < cutoff_date:
                        should_delete = True
                        reason = f'older than {days} days'
                
                if should_delete:
                    if dry_run:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  Would delete: {file_name} ({self._format_size(file_size)}) - {reason}'
                            )
                        )
                    else:
                        try:
                            file_path.unlink()
                            deleted_count += 1
                            deleted_size += file_size
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'  Deleted: {file_name} ({self._format_size(file_size)}) - {reason}'
                                )
                            )
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(f'  Error deleting {file_name}: {e}')
                            )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\nDRY RUN: Would delete {deleted_count} files ({self._format_size(deleted_size)})'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nDeleted {deleted_count} files, freed {self._format_size(deleted_size)}'
                )
            )
    
    def _format_size(self, size_bytes):
        """Format file size in human-readable format."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f'{size_bytes:.2f} {unit}'
            size_bytes /= 1024.0
        return f'{size_bytes:.2f} TB'

