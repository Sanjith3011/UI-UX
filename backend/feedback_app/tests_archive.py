import io
import zipfile
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import Project, ProjectArchive
from PIL import Image

User = get_user_model()

class ArchiveUploadTest(APITestCase):
    def setUp(self):
        # Create a test user and authenticate
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        # Create a project for the user
        self.project = Project.objects.create(user=self.user, title='Test Project', description='desc')
        # Create a simple image in memory
        img = Image.new('RGB', (10, 10), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        # Create a zip file in memory containing the image and a text file
        zip_bytes = io.BytesIO()
        with zipfile.ZipFile(zip_bytes, 'w') as zipf:
            zipf.writestr('test_image.png', img_bytes.read())
            zipf.writestr('readme.txt', 'This is a test file')
        zip_bytes.seek(0)
        self.zip_file = io.BytesIO(zip_bytes.read())
        self.zip_file.name = 'test_archive.zip'

    @override_settings(ARCHIVE_PROCESS_ASYNC=False)
    def test_archive_upload_and_processing(self):
        url = reverse('archive-upload')
        data = {'zip_file': self.zip_file, 'project': self.project.id}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        archive = ProjectArchive.objects.get(project=self.project)
        self.assertTrue(archive.processed)
        self.assertIsNotNone(archive.project_feedback)
        self.assertIn('raw_analysis', archive.project_feedback)
