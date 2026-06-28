from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, Design, ProjectComment, DesignLike, UserProfile
from .portfolio_serializers import (
    PublicProfileSerializer,
    PublicProjectDetailSerializer,
    ProfileSearchResultSerializer,
    ProjectCommentSerializer,
    CommentReplySerializer,
    UserProfileUpdateSerializer,
)


def _get_public_project(username, project_id):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return None, Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = UserProfile.objects.get_or_create(user=user)
    if not profile.portfolio_public:
        return None, Response({'detail': 'This profile is private.'}, status=status.HTTP_404_NOT_FOUND)

    project = Project.objects.filter(
        id=project_id, user=user, is_public=True
    ).select_related('user').prefetch_related('designs__feedback', 'designs__likes').first()

    if not project:
        return None, Response({'detail': 'Project not found or not public.'}, status=status.HTTP_404_NOT_FOUND)

    return project, None


class ProfileSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])

        profiles = UserProfile.objects.filter(
            portfolio_public=True,
            user__username__icontains=query,
        ).select_related('user')[:20]

        return Response(ProfileSearchResultSerializer(profiles, many=True).data)


class PublicProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if not profile.portfolio_public:
            return Response({'detail': 'This profile is private.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PublicProfileSerializer(profile).data)


class PublicProjectView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username, project_id):
        project, error = _get_public_project(username, project_id)
        if error:
            return error
        return Response(PublicProjectDetailSerializer(project, context={'request': request}).data)


class ProjectCommentListCreateView(APIView):
    """List comments on a public project; authenticated visitors can post comments."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request, username, project_id):
        project, error = _get_public_project(username, project_id)
        if error:
            return error

        comments = ProjectComment.objects.filter(
            project=project, parent__isnull=True
        ).select_related('author').prefetch_related('replies__author')
        return Response(ProjectCommentSerializer(comments, many=True).data)

    def post(self, request, username, project_id):
        project, error = _get_public_project(username, project_id)
        if error:
            return error

        if project.user == request.user:
            return Response(
                {'detail': 'Project owners cannot comment on their own project. Use replies instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = request.data.get('body', '').strip()
        if not body:
            return Response({'detail': 'Comment cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        comment = ProjectComment.objects.create(
            project=project,
            author=request.user,
            body=body,
        )
        return Response(ProjectCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class OwnerProjectCommentsView(APIView):
    """Project owner views all comments (including replies) on their project."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        project = Project.objects.filter(id=pk, user=request.user).first()
        if not project:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        comments = ProjectComment.objects.filter(
            project=project, parent__isnull=True
        ).select_related('author').prefetch_related('replies__author')
        return Response(ProjectCommentSerializer(comments, many=True).data)


class CommentReplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, comment_id):
        project = Project.objects.filter(id=pk, user=request.user).first()
        if not project:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        parent = ProjectComment.objects.filter(id=comment_id, project=project, parent__isnull=True).first()
        if not parent:
            return Response({'detail': 'Comment not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = request.data.get('body', '').strip()
        if not body:
            return Response({'detail': 'Reply cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        reply = ProjectComment.objects.create(
            project=project,
            author=request.user,
            parent=parent,
            body=body,
            is_owner_reply=True,
        )
        return Response(CommentReplySerializer(reply).data, status=status.HTTP_201_CREATED)


class DesignLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        design = Design.objects.filter(
            id=pk, is_public=True, project__is_public=True
        ).select_related('project').first()

        if not design:
            return Response({'detail': 'Design not found or not public.'}, status=status.HTTP_404_NOT_FOUND)

        like, created = DesignLike.objects.get_or_create(design=design, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True

        return Response({
            'liked': liked,
            'like_count': design.likes.count(),
        })


class ProjectVisibilityView(APIView):
    """Toggle project public/private. Making private also hides all designs."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        project = Project.objects.filter(id=pk, user=request.user).first()
        if not project:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_public' not in request.data:
            return Response({'detail': 'is_public field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        is_public = bool(request.data['is_public'])
        if is_public:
            has_archive = project.archives.filter(processed=True).exists()
            if not has_archive:
                return Response(
                    {'detail': 'You cannot make this project public before uploading and processing a project ZIP archive.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        project.is_public = is_public
        project.save(update_fields=['is_public', 'updated_at'])

        project.designs.update(is_public=is_public)

        from .serializers import ProjectSerializer
        project = Project.objects.filter(id=pk, user=request.user).prefetch_related(
            'designs__feedback', 'designs__likes'
        ).first()
        return Response(ProjectSerializer(project).data)


class MyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileUpdateSerializer(profile).data)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
