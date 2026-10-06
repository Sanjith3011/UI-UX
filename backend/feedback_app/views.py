import os
import io
import zipfile
import tempfile
import hashlib
import shutil
import threading
import logging
from django.conf import settings
from django.core.files import File
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, generics, status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
import re
from .models import Project, ProjectArchive, Design, AIFeedback, DesignShare
from .hybrid_models import HybridSubmission, HybridScreenshot
from .permissions import IsOwner
from .serializers import ProjectSerializer, DesignSerializer, AIFeedbackSerializer, UserSerializer, ProjectArchiveSerializer, HybridSubmissionSerializer
from .ai_service import analyze_design, analyze_project_file, summarize_project, analyze_project_files_batched, analyze_hybrid_submission
from .security_scanner import scan_zip_for_secrets, format_scan_error
from .privacy import get_privacy_policy

logger = logging.getLogger(__name__)

SKIP_FILES = frozenset({
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'tsconfig.json', 'jsconfig.json',
})


def _get_file_priority(ext: str) -> int:
    if ext in ('jsx', 'tsx', 'html', 'css', 'vue', 'svelte', 'scss', 'sass', 'less'):
        return 1
    if ext in ('js', 'ts', 'json'):
        return 2
    return 3


def _collect_files_from_zip(archive_path: str):
    """Extract a ZIP archive and collect analyzable text files up to configured limits."""
    max_files = getattr(settings, 'ZIP_MAX_FILES_TO_ANALYZE', 80)
    max_chars_per_file = getattr(settings, 'ZIP_MAX_CHARS_PER_FILE', 40000)
    max_total_chars = getattr(settings, 'ZIP_MAX_TOTAL_CHARS', 600000)
    allowed_ext = getattr(settings, 'ZIP_ALLOWED_EXTENSIONS', set())
    ignored_dirs = getattr(settings, 'ZIP_IGNORED_DIRS', set())

    from .ai_service import _truncate_content

    all_collected_files = []
    total_chars = 0
    temp_dir = tempfile.mkdtemp()

    try:
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        for root, dirs, files in os.walk(temp_dir):
            dirs[:] = [d for d in dirs if d.lower() not in ignored_dirs]

            for file in files:
                if file.lower() in SKIP_FILES:
                    continue

                file_path = os.path.join(root, file)
                
                # Check for sensitive content
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content_peek = f.read(10000) # Peek at file
                        if re.search(r'(?i)password\s*[:=]\s*', content_peek) or re.search(r'(?i)api[_-]?key\s*[:=]\s*', content_peek) or re.search(r'(?i)secret\s*[:=]\s*', content_peek):
                            logger.warning(f"Skipping potentially sensitive file: {file_path}")
                            continue
                except Exception:
                    pass

                ext = file.lower().rsplit('.', 1)[-1] if '.' in file else ''
                if ext not in allowed_ext:
                    continue

                rel_path = os.path.relpath(file_path, temp_dir).replace('\\', '/')
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = _truncate_content(f.read(max_chars_per_file * 2), max_chars_per_file)
                except Exception:
                    continue

                if not content.strip():
                    continue

                all_collected_files.append({
                    'file_name': rel_path,
                    'ext': ext,
                    'content': content,
                })
                total_chars += len(content)

        all_collected_files.sort(key=lambda item: (_get_file_priority(item['ext']), item['file_name']))

        selected_files = []
        selected_chars = 0
        for item in all_collected_files:
            if len(selected_files) >= max_files:
                break
            if selected_chars + len(item['content']) > max_total_chars and selected_files:
                break
            selected_files.append(item)
            selected_chars += len(item['content'])

        return [
            {'file_name': f['file_name'], 'content': f['content']}
            for f in selected_files
        ], len(all_collected_files)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _update_archive_progress(archive_id: int, progress: dict):
    ProjectArchive.objects.filter(id=archive_id).update(processing_progress=progress)


def _generate_mockup_image(file_name: str, ui_score: int, ux_score: int):
    from PIL import Image, ImageDraw, ImageFont
    
    # Create an image with size 960x640 (standard mockup ratio)
    img = Image.new('RGB', (960, 640), color='#0d0e15')
    draw = ImageDraw.Draw(img)
    
    # Draw a subtle background gradient or panel (simulated with layered shapes)
    draw.rectangle([20, 20, 940, 620], fill='#161824', outline='#24283b', width=1)
    
    # Simulated sidebar
    draw.rectangle([20, 20, 100, 620], fill='#1c1e2e', outline='#24283b', width=1)
    for i in range(5):
        # Draw some sidebar icon placeholders
        cy = 60 + i * 50
        draw.ellipse([50, cy-15, 70, cy+5], fill='#2f344f')
        
    # Simulated top bar
    draw.rectangle([100, 20, 940, 80], fill='#1c1e2e', outline='#24283b', width=1)
    # Search bar placeholder
    draw.rectangle([130, 35, 400, 65], fill='#0d0e15', outline='#2f344f', width=1)
    
    # Title "Mockup: file_name"
    font = None
    try:
        font = ImageFont.truetype("arial.ttf", 20)
        font_sm = ImageFont.truetype("arial.ttf", 14)
        font_lg = ImageFont.truetype("arial.ttf", 32)
    except Exception:
        font = ImageFont.load_default()
        font_sm = ImageFont.load_default()
        font_lg = ImageFont.load_default()
        
    # Draw header text
    draw.text((450, 40), f"AI GENERATED PAGE MOCKUP", fill='#7aa2f7', font=font_sm)
    
    # Main visual container/card
    draw.rectangle([130, 110, 910, 600], fill='#1f2335', outline='#2f344f', width=1)
    
    # Mock visual grid
    # Left visual block (hero image placeholder)
    draw.rectangle([160, 140, 500, 350], fill='#24283b', outline='#7aa2f7', width=2)
    draw.text((250, 230), "[ HERO VISUAL ]", fill='#565f89', font=font)
    
    # Right text block
    draw.text((530, 140), "PAGE SUMMARY & DETAILS", fill='#bb9af7', font=font)
    draw.rectangle([530, 175, 880, 185], fill='#24283b')
    draw.rectangle([530, 195, 880, 205], fill='#24283b')
    draw.rectangle([530, 215, 800, 225], fill='#24283b')
    draw.rectangle([530, 235, 700, 245], fill='#24283b')
    
    # Big title of the page
    draw.text((160, 390), f"File: {file_name}", fill='#c0caf5', font=font_lg)
    
    # Visual grid / statistics cards
    # UI Score Card
    draw.rectangle([160, 470, 360, 570], fill='#24283b', outline='#9ece6a', width=2)
    draw.text((180, 490), "UI SCORE", fill='#9ece6a', font=font_sm)
    draw.text((180, 510), f"{ui_score}/10", fill='#9ece6a', font=font_lg)
    
    # UX Score Card
    draw.rectangle([390, 470, 590, 570], fill='#24283b', outline='#ff9e64', width=2)
    draw.text((410, 490), "UX SCORE", fill='#ff9e64', font=font_sm)
    draw.text((410, 510), f"{ux_score}/10", fill='#ff9e64', font=font_lg)
    
    # Layout visual mockup elements below
    draw.rectangle([620, 310, 880, 570], fill='#24283b', outline='#f7768e', width=2)
    draw.text((640, 330), "COMPONENTS HIERARCHY", fill='#f7768e', font=font_sm)
    draw.text((640, 370), "• Main Container", fill='#c0caf5', font=font_sm)
    draw.text((640, 400), "• Sidebar Navigator", fill='#c0caf5', font=font_sm)
    draw.text((640, 430), "• Details Dashboard", fill='#c0caf5', font=font_sm)
    draw.text((640, 460), "• Evaluation Badges", fill='#c0caf5', font=font_sm)
    
    return img


def generate_mockups_for_archive(archive):
    """Generate designs/mockup images automatically from the analyzed files in the project archive."""
    try:
        from PIL import Image
        from django.core.files.base import ContentFile
        from .models import Design, AIFeedback
        
        file_analyses = archive.analysis or []
        if not file_analyses:
            return
            
        # Prioritize UI structure files
        ui_files = []
        for item in file_analyses:
            file_name = item.get('file_name', '')
            ext = file_name.lower().rsplit('.', 1)[-1] if '.' in file_name else ''
            if ext in ('html', 'jsx', 'tsx', 'vue', 'svelte', 'css'):
                ui_files.append(item)
                
        # If no UI files found, fall back to any files
        if not ui_files:
            ui_files = file_analyses[:3]
        else:
            ui_files = ui_files[:5]
            
        # Clear existing designs/mockups for this project to overwrite
        Design.objects.filter(project=archive.project).delete()
        
        for index, item in enumerate(ui_files):
            file_name = item.get('file_name', '')
            analysis_data = item.get('analysis', {})
            raw_analysis = analysis_data.get('raw_analysis', 'No detailed feedback provided.')
            ui_score = analysis_data.get('ui_score', 0) or 0
            ux_score = analysis_data.get('ux_score', 0) or 0
            
            # Generate the mockup image
            img = _generate_mockup_image(file_name, ui_score, ux_score)
            
            img_io = io.BytesIO()
            img.save(img_io, format='PNG')
            img_file = ContentFile(img_io.getvalue(), name=f"mockup_{index}_{os.path.basename(file_name)}.png")
            
            # Create Design object
            design = Design.objects.create(
                project=archive.project,
                image=img_file,
                is_public=archive.project.is_public
            )
            
            # Create associated AIFeedback
            AIFeedback.objects.create(
                design=design,
                raw_analysis=raw_analysis,
                ui_score=ui_score,
                ux_score=ux_score
            )
            
        logger.info("Successfully generated %s mockups for project %s", len(ui_files), archive.project.id)
    except Exception as e:
        logger.exception("Failed to generate mockups for archive: %s", e)


def process_project_archive(archive_id: int):
    """Extract, analyze, and persist feedback for an uploaded project archive."""
    archive = ProjectArchive.objects.filter(id=archive_id).first()
    if not archive:
        return

    archive_path = archive.zip_file.path

    def on_progress(progress):
        # Check if the user has requested cancellation
        try:
            arch = ProjectArchive.objects.get(id=archive_id)
            if getattr(arch, 'cancelled', False):
                # Mark archive as cancelled and abort processing
                arch.processing_progress = {"stage": "cancelled", "message": "Processing cancelled by user.", "percent": progress.get('percent', 0)}
                arch.error_message = "Cancelled by user"
                arch.save()
                raise KeyboardInterrupt("Processing cancelled by user")
        except ProjectArchive.DoesNotExist:
            pass
        _update_archive_progress(archive_id, progress)

    try:
        _update_archive_progress(archive_id, {
            "stage": "extracting",
            "current_batch": 0,
            "total_batches": 0,
            "message": "Extracting and scanning ZIP archive...",
            "percent": 5,
        })

        if not zipfile.is_zipfile(archive_path):
            raise ValueError(
                "The uploaded file is not a valid ZIP archive. Please ensure you are uploading a .zip file."
            )

        hasher = hashlib.sha256()
        with open(archive_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        archive.zip_hash = hasher.hexdigest()
        archive.save(update_fields=['zip_hash'])

        text_files_to_analyze, total_discovered = _collect_files_from_zip(archive_path)
        if not text_files_to_analyze:
            _update_archive_progress(archive_id, {
                "stage": "collected",
                "percent": 15,
                "message": "Collected files for analysis",
            })
            raise ValueError(
                "No analyzable source files found in the ZIP. "
                "Include HTML, CSS, JS/TS, JSX/TSX, Vue, or similar UI files."
            )

        batch_size = getattr(settings, 'ZIP_BATCH_SIZE', 10)
        total_batches = max(1, (len(text_files_to_analyze) + batch_size - 1) // batch_size)
        _update_archive_progress(archive_id, {
            "stage": "preparing",
            "current_batch": 0,
            "total_batches": total_batches,
            "message": f"Found {len(text_files_to_analyze)} files to analyze ({total_discovered} discovered in ZIP)",
            "percent": 8,
            "files_selected": len(text_files_to_analyze),
            "files_discovered": total_discovered,
        })

        logger.info(
            "Analyzing archive %s: %s files selected from %s discovered",
            archive_id,
            len(text_files_to_analyze),
            total_discovered,
        )

        bundled_result = analyze_project_files_batched(text_files_to_analyze, on_progress=on_progress)
        archive.project_feedback = bundled_result.get('project_feedback', {})
        archive.analysis = bundled_result.get('files_analyses', [])
        archive.processed = True
        archive.error_message = None
        archive.processing_progress = None
        archive.save()
        generate_mockups_for_archive(archive)

        try:
            os.remove(archive_path)
        except Exception:
            pass

    except KeyboardInterrupt:
        logger.info("Archive processing cancelled by user for archive %s", archive_id)
        # Ensure cancelled flag is set (already set in on_progress)
        archive.processed = False
        archive.save()
    except Exception as e:
        logger.exception("Failed to process archive %s", archive_id)
        archive.error_message = str(e)
        archive.processed = False
        archive.processing_progress = {
            "stage": "failed",
            "message": str(e),
            "percent": 0,
        }
        archive.save()
        try:
            if os.path.exists(archive_path):
                os.remove(archive_path)
        except Exception:
            pass

def render_to_pdf(html_string):
    """Render HTML to PDF using xhtml2pdf (pisa). If the library is unavailable, return None.
    Handles static and media URLs via a link callback."""
    try:
        from xhtml2pdf import pisa
    except ImportError:
        # xhtml2pdf not installed; skip PDF generation.
        return None

    def link_callback(uri, rel):
        """Convert URIs to absolute system paths for pisa.
        Supports MEDIA_URL and STATIC_URL.
        """
        if uri.startswith(settings.MEDIA_URL):
            path = os.path.join(settings.MEDIA_ROOT, uri.replace(settings.MEDIA_URL, ""))
        elif uri.startswith(settings.STATIC_URL):
            path = os.path.join(settings.STATIC_ROOT, uri.replace(settings.STATIC_URL, ""))
        else:
            return uri
        return path

    result = io.BytesIO()
    pdf = pisa.pisaDocument(io.BytesIO(html_string.encode("utf-8")), result, link_callback=link_callback)
    if not pdf.err:
        return result.getvalue()
    return None

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class DesignViewSet(viewsets.ModelViewSet):
    # CRUD for Design objects belonging to the authenticated user's projects.
    serializer_class = DesignSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Design.objects.filter(project__user=self.request.user).order_by('-uploaded_at')

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Manual design uploads are disabled. Designs are automatically generated from your project ZIP uploads."},
            status=status.HTTP_403_FORBIDDEN
        )

    def destroy(self, request, *args, **kwargs):
        """Delete a Design, its image file, and related AIFeedback safely."""
        design_id = kwargs.get('pk')
        try:
            design_instance = self.get_object()
            with transaction.atomic():
                # Delete related feedback explicitly (in case of OneToOne relationship)
                AIFeedback.objects.filter(design=design_instance).delete()
                # Remove the image file from storage if it exists using Django storage API
                if design_instance.image:
                    try:
                        design_instance.image.delete(save=False)
                    except Exception as delete_err:
                        print(f"Failed to delete image file for Design id={design_id}: {delete_err}")
                # Finally, delete the design via the superclass implementation
                return super().destroy(request, *args, **kwargs)
        except Exception as e:
            print(f"Error deleting Design id={design_id}: {e}")
            return Response({"detail": f"Error deleting design: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AIFeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = AIFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AIFeedback.objects.filter(design__project__user=self.request.user).order_by('-generated_at')

class ArchiveUploadView(generics.CreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectArchiveSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Save the archive instance linked to the provided project
        archive = serializer.save(project_id=request.data.get('project'))

        # Enforce the single‑ZIP policy: if a processed feedback already exists for this project,
        # reject the upload and ask the user to delete the existing feedback first.
        existing_feedback = ProjectArchive.objects.filter(project_id=request.data.get('project'), processed=True).first()
        if existing_feedback:
            # Clean up the newly created (unused) archive record
            archive.delete()
            return Response(
                {"detail": "A processed feedback already exists for this project. Please delete the existing feedback before uploading a new ZIP archive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        archive_path = archive.zip_file.path
        max_upload_bytes = getattr(settings, 'MAX_ZIP_UPLOAD_SIZE_MB', 100) * 1024 * 1024
        try:
            zip_size = os.path.getsize(archive_path)
        except OSError:
            zip_size = 0

        if zip_size > max_upload_bytes:
            archive.delete()
            max_mb = getattr(settings, 'MAX_ZIP_UPLOAD_SIZE_MB', 100)
            return Response(
                {"detail": f"ZIP file is too large ({zip_size // (1024 * 1024)} MB). Maximum allowed size is {max_mb} MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not zipfile.is_zipfile(archive_path):
            archive.delete()
            return Response(
                {"detail": "The uploaded file is not a valid ZIP archive. Please upload a .zip file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        secret_findings = scan_zip_for_secrets(archive_path)
        blocked_files = []
        blocked_msg = None
        if secret_findings:
            # List of files that contain secrets
            blocked_files = [item['file'] for item in secret_findings]
            blocked_msg = format_scan_error(secret_findings)
            # Create a cleaned ZIP without the blocked files
            cleaned_path = f"{archive_path}.clean.zip"
            with zipfile.ZipFile(archive_path, 'r') as src, zipfile.ZipFile(cleaned_path, 'w') as dst:
                for item in src.infolist():
                    if item.filename in blocked_files:
                        continue
                    data = src.read(item.filename)
                    dst.writestr(item, data)
            # Replace the original archive file with the cleaned version
            with open(cleaned_path, 'rb') as f:
                archive.zip_file.save(os.path.basename(cleaned_path), File(f))
            # Remove temporary files
            try:
                os.remove(archive_path)
                os.remove(cleaned_path)
            except Exception:
                pass
            # Update archive_path to point to the new file for further processing
            archive_path = archive.zip_file.path

        process_async = getattr(settings, 'ARCHIVE_PROCESS_ASYNC', True)
        if process_async:
            # Pass blocked file list to processing thread via closure
            thread = threading.Thread(
                target=process_project_archive,
                args=(archive.id,),
                daemon=True,
            )
            thread.start()
            response_data = self.get_serializer(archive).data
            if blocked_msg:
                response_data['blocked_files'] = blocked_files
                response_data['blocked_message'] = blocked_msg
            return Response(
                response_data,
                status=status.HTTP_202_ACCEPTED,
            )

        process_project_archive(archive.id)
        archive.refresh_from_db()
        if not archive.processed:
            return Response(
                {"detail": f"Failed to process archive: {archive.error_message}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(self.get_serializer(archive).data, status=status.HTTP_201_CREATED)

    def _run_ai_analysis(self, design_instance):
        try:
            image_path = design_instance.image.path
            ai_result = analyze_design(image_path)
            AIFeedback.objects.update_or_create(
                design=design_instance,
                defaults={
                    'raw_analysis': ai_result.get('raw_analysis', ''),
                    'ui_score': ai_result.get('ui_score') if isinstance(ai_result.get('ui_score'), int) else 0,
                    'ux_score': ai_result.get('ux_score') if isinstance(ai_result.get('ux_score'), int) else 0,
                }
            )
        except Exception as e:
            print(f"Failed to analyze design {design_instance.id}: {e}")

class DesignPDFView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            design = Design.objects.get(id=pk, project__user=request.user)
            html_string = render_to_string('feedback_app/report_design.html', {'design': design})
            pdf_file = render_to_pdf(html_string)
            if not pdf_file:
                return JsonResponse({'detail': 'PDF generation failed.'}, status=500)
            response = HttpResponse(pdf_file, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="design_{design.id}_report.pdf"'
            return response
        except Design.DoesNotExist:
            return JsonResponse({'detail': 'Not found.'}, status=404)

class ProjectReportPDFView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            project = Project.objects.get(id=pk, user=request.user)
        except Project.DoesNotExist:
            return JsonResponse({'detail': 'Not found.'}, status=404)

        archive = ProjectArchive.objects.filter(project=project, processed=True).order_by('-uploaded_at').first()
        project_feedback = archive.project_feedback if archive else None
        designs = Design.objects.filter(project=project).prefetch_related('feedback')

        html_string = render_to_string('feedback_app/report_project.html', {
            'project': project,
            'designs': designs,
            'project_feedback': project_feedback,
        })
        pdf_file = render_to_pdf(html_string)
        if not pdf_file:
            return JsonResponse({'detail': 'PDF generation failed.'}, status=500)
        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="project_{project.id}_report.pdf"'
        return response

class DesignShareCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            design = Design.objects.get(id=pk, project__user=request.user)
            share, created = DesignShare.objects.get_or_create(design=design)
            if created:
                share.save()
            return JsonResponse({'share_url': f'/public/report/{share.token}/'}, status=201)
        except Design.DoesNotExist:
            return JsonResponse({'detail': 'Not found.'}, status=404)

class PublicReportView(APIView):
    permission_classes = []

    def get(self, request, token):
        try:
            share = DesignShare.objects.get(token=token)
            design = share.design
            html_string = render_to_string('feedback_app/report_design.html', {'design': design, 'public': True})
            return HttpResponse(html_string)
        except DesignShare.DoesNotExist:
            return JsonResponse({'detail': 'Invalid share token.'}, status=404)

class PrivacyPolicyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return JsonResponse(get_privacy_policy())


class CancelArchiveUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Allow a user to cancel an ongoing archive upload processing."""
        try:
            archive = ProjectArchive.objects.get(id=pk, project__user=request.user)
        except ProjectArchive.DoesNotExist:
            return Response({"detail": "Archive not found."}, status=status.HTTP_404_NOT_FOUND)

        archive.cancelled = True
        archive.save()
        return Response({"detail": "Cancellation request received."}, status=status.HTTP_200_OK)


class DeleteAllUserDataView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        # pyrefly: ignore [parse-error]
        """Delete all projects, designs, archives, feedback, and media for the authenticated user."""
        user = request.user
        try:
            with transaction.atomic():
                projects = Project.objects.filter(user=user)
                for project in projects.prefetch_related('designs', 'archives'):
                    for design in project.designs.all():
                        if design.image:
                            try:
                                design.image.delete(save=False)
                            except Exception:
                                pass
                    for archive in project.archives.all():
                        if archive.zip_file:
                            try:
                                archive.zip_file.delete(save=False)
                            except Exception:
                                pass
                project_count = projects.count()
                projects.delete()

            return JsonResponse({
                'detail': 'All your data has been permanently deleted.',
                'projects_deleted': project_count,
            })
        except Exception as e:
            logger.exception("Failed to delete all data for user %s", user.id)
            return JsonResponse({'detail': f'Error deleting data: {str(e)}'}, status=500)


class DeleteProjectFeedbackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        """Delete all archives and hybrid submissions (and their feedback) for the given project."""
        try:
            try:
                project = Project.objects.get(id=pk)
            except Project.DoesNotExist:
                return JsonResponse({'detail': 'Project not found.'}, status=404)

            if project.user != request.user:
                return JsonResponse({'detail': 'Permission denied.'}, status=403)

            ProjectArchive.objects.filter(project=project).delete()
            HybridSubmission.objects.filter(project=project).delete()
            return JsonResponse({'detail': 'Processed feedback and all project submissions deleted.'}, status=200)
        except Exception as e:
            return JsonResponse({'detail': f'Error deleting feedback: {str(e)}'}, status=500)


def _extract_report_text(file_path):
    if not file_path or not os.path.exists(file_path):
        return ""
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    try:
        if ext == '.pdf':
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                pages = [page.extract_text() or "" for page in reader.pages[:25]]
                text = "\n\n".join(pages)
            except Exception:
                try:
                    import pdfplumber
                    with pdfplumber.open(file_path) as pdf:
                        pages = [p.extract_text() or "" for p in pdf.pages[:25]]
                        text = "\n\n".join(pages)
                except Exception as e2:
                    logger.warning(f"PDF extraction error: {e2}")
        elif ext in ('.docx', '.doc'):
            try:
                import docx
                doc = docx.Document(file_path)
                text = "\n".join([p.text for p in doc.paragraphs if p.text])
            except Exception as e:
                logger.warning(f"DOCX extraction error: {e}")
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read(150_000)
    except Exception as e:
        logger.error(f"Error reading report file {file_path}: {e}")
    return text.strip()


def process_hybrid_submission_async(submission_id):
    try:
        submission = HybridSubmission.objects.get(id=submission_id)
        submission.status = 'processing'
        submission.save(update_fields=['status'])

        report_text = _extract_report_text(submission.report_file.path)
        screenshots = list(submission.screenshots.all())

        screenshot_evaluations = []
        for idx, shot in enumerate(screenshots, start=1):
            design = None
            if submission.project:
                design = Design.objects.create(
                    project=submission.project,
                    image=shot.image,
                    is_public=submission.project.is_public
                )

            img_path = shot.image.path
            img_analysis = analyze_design(img_path)

            if design and img_analysis:
                AIFeedback.objects.create(
                    design=design,
                    raw_analysis=img_analysis.get('raw_analysis', ''),
                    ui_score=img_analysis.get('ui_score') or 0,
                    ux_score=img_analysis.get('ux_score') or 0
                )

            screenshot_evaluations.append({
                "screenshot_index": idx,
                "ui_score": img_analysis.get('ui_score') if img_analysis else None,
                "ux_score": img_analysis.get('ux_score') if img_analysis else None,
                "summary": (img_analysis.get('raw_analysis') or '')[:300] if img_analysis else ''
            })

        feedback_result = analyze_hybrid_submission(
            report_text=report_text,
            screenshot_evaluations=screenshot_evaluations,
            custom_prompt=submission.prompt
        )

        submission.status = 'done'
        submission.result = feedback_result
        submission.save(update_fields=['status', 'result'])

    except Exception as e:
        logger.exception("Failed to process hybrid submission %s", submission_id)
        try:
            sub = HybridSubmission.objects.get(id=submission_id)
            sub.status = 'failed'
            sub.result = {'error': str(e)}
            sub.save(update_fields=['status', 'result'])
        except Exception:
            pass


class HybridSubmissionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        report_file = request.FILES.get('report_file')
        prompt = request.data.get('prompt', '')
        project_id = request.data.get('project') or request.data.get('project_id')

        project = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id, user=request.user)
            except Project.DoesNotExist:
                return Response({'detail': 'Project not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if not report_file:
            return Response({'detail': 'A report file (.pdf, .docx, .txt) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        submission = HybridSubmission.objects.create(
            user=request.user,
            project=project,
            report_file=report_file,
            prompt=prompt,
            status='queued'
        )

        screenshots = request.FILES.getlist('screenshots')
        for s in screenshots:
            HybridScreenshot.objects.create(submission=submission, image=s)

        t = threading.Thread(target=process_hybrid_submission_async, args=(submission.id,))
        t.daemon = True
        t.start()

        serializer = HybridSubmissionSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get(self, request, *args, **kwargs):
        project_id = request.query_params.get('project')
        qs = HybridSubmission.objects.filter(user=request.user)
        if project_id:
            qs = qs.filter(project_id=project_id)
        submissions = qs.order_by('-created_at')
        serializer = HybridSubmissionSerializer(submissions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

