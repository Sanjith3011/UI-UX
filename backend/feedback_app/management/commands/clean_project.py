# -*- coding: utf-8 -*-
"""Django management command to clean up unwanted files and orphaned media.

Usage:
    python manage.py clean_project

The command performs the following actions:
1. Recursively deletes all `__pycache__` directories and `*.pyc` files.
2. Removes any image files under `media/designs/` that no longer have a corresponding
   `Design` record in the database (orphaned files).
3. Optionally removes empty temporary directories under the project root.

All operations are wrapped in a database transaction where applicable to ensure
that any DB‑related cleanup can be rolled back on error.
"""

import os
import shutil
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

# Import models lazily inside the command to avoid circular imports.

class Command(BaseCommand):
    help = "Clean up __pycache__, .pyc files, and orphaned design media files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually removing files.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        base_dir = Path(__file__).resolve().parents[3]  # project root (backend)
        media_designs_dir = base_dir / "media" / "designs"

        # 1. Delete __pycache__ and .pyc files
        self.stdout.write("Scanning for __pycache__ directories and .pyc files...")
        for root, dirs, files in os.walk(base_dir):
            # Remove __pycache__ directories
            if "__pycache__" in dirs:
                pycache_path = Path(root) / "__pycache__"
                if dry_run:
                    self.stdout.write(f"[dry‑run] Would remove directory: {pycache_path}")
                else:
                    shutil.rmtree(pycache_path)
                    self.stdout.write(f"Removed directory: {pycache_path}")
                dirs.remove("__pycache__")  # prevent descending into it
            # Remove .pyc files
            for file in files:
                if file.endswith('.pyc'):
                    file_path = Path(root) / file
                    if dry_run:
                        self.stdout.write(f"[dry‑run] Would remove file: {file_path}")
                    else:
                        file_path.unlink()
                        self.stdout.write(f"Removed file: {file_path}")

        # 2. Clean orphaned design media files
        self.stdout.write("\nCleaning orphaned design media files...")
        try:
            # Import inside the try to avoid import errors before Django is fully ready.
            from feedback_app.models import Design
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to import Design model: {e}"))
            return

        with transaction.atomic():
            design_ids = set(Design.objects.values_list('id', flat=True))
            if not media_designs_dir.exists():
                self.stdout.write("No media/designs/ directory found; skipping.")
            else:
                for media_file in media_designs_dir.iterdir():
                    if not media_file.is_file():
                        continue
                    # Attempt to extract the design id from the filename.
                    # Default naming scheme is <uuid>.<ext> – we check via DB.
                    # If the file name does not match any Design, we delete it.
                    try:
                        # Look up by image field path (relative to MEDIA_ROOT)
                        rel_path = f"designs/{media_file.name}"
                        exists = Design.objects.filter(image=rel_path).exists()
                    except Exception:
                        exists = False
                    if not exists:
                        if dry_run:
                            self.stdout.write(f"[dry‑run] Would remove orphaned media file: {media_file}")
                        else:
                            media_file.unlink()
                            self.stdout.write(f"Removed orphaned media file: {media_file}")

        # 3. Remove empty temporary directories under the project root
        self.stdout.write("\nRemoving empty temporary directories (if any)...")
        temp_root = Path(os.getenv('TEMP', '/tmp'))
        # Only attempt to clean directories that are inside the project root
        for dirpath, dirnames, filenames in os.walk(base_dir):
            # Skip if there are files – not empty
            if filenames or dirnames:
                continue
            dir_path = Path(dirpath)
            if dry_run:
                self.stdout.write(f"[dry‑run] Would remove empty directory: {dir_path}")
            else:
                try:
                    dir_path.rmdir()
                    self.stdout.write(f"Removed empty directory: {dir_path}")
                except OSError:
                    # Directory not empty or removal failed; ignore
                    pass

        self.stdout.write(self.style.SUCCESS("Project cleanup completed."))
