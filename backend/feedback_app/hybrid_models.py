from django.db import models
from django.contrib.auth.models import User


class HybridSubmission(models.Model):
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hybrid_submissions')
    project = models.ForeignKey('feedback_app.Project', on_delete=models.CASCADE, related_name='hybrid_submissions', null=True, blank=True)
    report_file = models.FileField(upload_to='reports/')  # PDF/DOCX/TXT
    prompt = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='queued')
    result = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"HybridSubmission #{self.id} by {self.user.username}"


class HybridScreenshot(models.Model):
    submission = models.ForeignKey(HybridSubmission, on_delete=models.CASCADE, related_name='screenshots')
    image = models.ImageField(upload_to='hybrid_screenshots/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Screenshot {self.id} for Submission {self.submission.id}"
