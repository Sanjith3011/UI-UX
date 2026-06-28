from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    portfolio_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile: {self.user.username}"


class Project(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects', null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Design(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='designs')
    image = models.ImageField(upload_to='designs/')
    is_public = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Design {self.id} in {self.project.title}"


class DesignShare(models.Model):
    design = models.OneToOneField(Design, on_delete=models.CASCADE, related_name='share')
    token = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.token:
            import uuid
            self.token = uuid.uuid4().hex
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Share token for Design {self.design.id}"


class ProjectArchive(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='archives')
    zip_file = models.FileField(upload_to='archives/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)
    zip_hash = models.CharField(max_length=64, blank=True, null=True)
    analysis = models.JSONField(blank=True, null=True)
    project_feedback = models.JSONField(blank=True, null=True)
    processing_progress = models.JSONField(blank=True, null=True)
    cancelled = models.BooleanField(default=False)
    # Tracks if the user has requested cancellation of processing.

    def __str__(self):
        return f"Archive for {self.project.title} ({self.id})"


class AIFeedback(models.Model):
    design = models.OneToOneField(Design, on_delete=models.CASCADE, related_name='feedback')
    raw_analysis = models.TextField()
    ui_score = models.IntegerField(default=0)
    ux_score = models.IntegerField(default=0)
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback for {self.design}"


class ProjectComment(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='project_comments')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    body = models.TextField()
    is_owner_reply = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on {self.project.title}"


class DesignLike(models.Model):
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='design_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('design', 'user')

    def __str__(self):
        return f"{self.user.username} likes design {self.design.id}"


class FriendRequest(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_friend_requests')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_friend_requests')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')

    def __str__(self):
        return f"Request: {self.sender.username} to {self.receiver.username}"


class Friendship(models.Model):
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships_b')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user_a', 'user_b')

    def __str__(self):
        return f"Friendship: {self.user_a.username} & {self.user_b.username}"


class ChatMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg from {self.sender.username} to {self.receiver.username} at {self.created_at}"
