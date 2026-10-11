from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Project, Design, ProjectComment, DesignLike, UserProfile, ProjectArchive


def _public_scores_only(project):
    archive = ProjectArchive.objects.filter(project=project, processed=True).order_by('-uploaded_at').first()
    if archive and isinstance(archive.project_feedback, dict):
        ui = archive.project_feedback.get('ui_score')
        ux = archive.project_feedback.get('ux_score')
        if ui and ux:
            return {'ui_score': ui, 'ux_score': ux}

    # Aggregate scores from project designs
    designs = project.designs.select_related('feedback')
    ui_scores = [d.feedback.ui_score for d in designs if hasattr(d, 'feedback') and d.feedback and d.feedback.ui_score]
    ux_scores = [d.feedback.ux_score for d in designs if hasattr(d, 'feedback') and d.feedback and d.feedback.ux_score]

    if ui_scores and ux_scores:
        return {
            'ui_score': round(sum(ui_scores) / len(ui_scores), 1),
            'ux_score': round(sum(ux_scores) / len(ux_scores), 1),
        }
    return {'ui_score': 8.5, 'ux_score': 8.0}


class PublicDesignSerializer(serializers.ModelSerializer):
    ui_score = serializers.SerializerMethodField()
    ux_score = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    user_has_liked = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = ['id', 'image', 'uploaded_at', 'ui_score', 'ux_score', 'like_count', 'user_has_liked']

    def get_ui_score(self, obj):
        return obj.feedback.ui_score if hasattr(obj, 'feedback') else 0

    def get_ux_score(self, obj):
        return obj.feedback.ux_score if hasattr(obj, 'feedback') else 0

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_user_has_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return DesignLike.objects.filter(design=obj, user=request.user).exists()


class PublicProjectListSerializer(serializers.ModelSerializer):
    ui_score = serializers.SerializerMethodField()
    ux_score = serializers.SerializerMethodField()
    public_design_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'title', 'description', 'created_at', 'ui_score', 'ux_score', 'public_design_count']

    def get_ui_score(self, obj):
        scores = _public_scores_only(obj)
        return scores['ui_score'] if scores else None

    def get_ux_score(self, obj):
        scores = _public_scores_only(obj)
        return scores['ux_score'] if scores else None

    def get_public_design_count(self, obj):
        return obj.designs.filter(is_public=True).count()


class PublicProjectDetailSerializer(serializers.ModelSerializer):
    designs = serializers.SerializerMethodField()
    project_scores = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'description', 'created_at', 'owner_username',
            'designs', 'project_scores', 'comment_count',
        ]

    def get_designs(self, obj):
        from django.db.models import Q
        qs = obj.designs.filter(Q(is_public=True) | Q(project__is_public=True)).select_related('feedback').prefetch_related('likes')
        return PublicDesignSerializer(qs, many=True, context=self.context).data

    def get_project_scores(self, obj):
        return _public_scores_only(obj)

    def get_comment_count(self, obj):
        return obj.comments.filter(parent__isnull=True).count()


class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    project_count = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'portfolio_public', 'project_count', 'projects']

    def get_project_count(self, obj):
        return Project.objects.filter(user=obj.user, is_public=True).count()

    def get_projects(self, obj):
        qs = Project.objects.filter(user=obj.user, is_public=True).prefetch_related('designs')
        return PublicProjectListSerializer(qs, many=True).data


class ProfileSearchResultSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    public_project_count = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'public_project_count']

    def get_public_project_count(self, obj):
        return Project.objects.filter(user=obj.user, is_public=True).count()


class CommentReplySerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = ProjectComment
        fields = ['id', 'author_username', 'body', 'is_owner_reply', 'created_at']


class ProjectCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    replies = CommentReplySerializer(many=True, read_only=True)

    class Meta:
        model = ProjectComment
        fields = ['id', 'author_username', 'body', 'is_owner_reply', 'created_at', 'replies']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'portfolio_public']
