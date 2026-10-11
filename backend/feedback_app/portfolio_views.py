from django.contrib.auth.models import User
from django.db.models import Q
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


class PublicDesignsView(APIView):
    """
    Public community showcase feed.
    Shows the overall project cards, each with a single design thumbnail and overall UI/UX scores.
    Clicking the project card allows viewing the full project with all of its designs.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        sort = request.query_params.get('sort', 'latest')
        query = request.query_params.get('q', '').strip()

        friend_ids = []
        if user:
            from .models import Friendship
            friendships = Friendship.objects.filter(Q(user_a=user) | Q(user_b=user))
            friends = [f.user_b if f.user_a == user else f.user_a for f in friendships]
            friend_ids = [friend.id for friend in friends]

        project_q = Q(is_public=True)
        if user:
            project_q |= Q(user_id__in=friend_ids) | Q(user=user)

        if query:
            project_q &= (Q(title__icontains=query) | Q(description__icontains=query) | Q(user__username__icontains=query))

        projects = Project.objects.filter(project_q).select_related('user').prefetch_related(
            'designs__feedback', 'designs__likes', 'comments', 'archives'
        ).distinct()

        items = []
        for p in projects:
            p_designs = list(p.designs.filter(~Q(image='')).order_by('-uploaded_at'))
            if not p_designs:
                continue

            primary_design = p_designs[0]
            thumbnail_url = request.build_absolute_uri(primary_design.image.url) if (primary_design.image and hasattr(primary_design.image, 'url')) else None

            scores = _public_scores_only(p) or {'ui_score': 8.5, 'ux_score': 8.0}
            ui_score = scores.get('ui_score', 8.5)
            ux_score = scores.get('ux_score', 8.0)
            overall_score = round((ui_score + ux_score) / 2, 1)

            all_likes_count = sum(d.likes.count() for d in p_designs)
            user_has_liked = False
            if user:
                user_has_liked = any(
                    d.likes.filter(user=user).exists() for d in p_designs
                )

            owner_name = p.user.username if p.user else 'Anonymous'
            comment_count = p.comments.filter(parent__isnull=True).count()

            items.append({
                'id': p.id,
                'project_id': p.id,
                'title': p.title,
                'project_title': p.title,
                'description': p.description or '',
                'username': owner_name,
                'owner_username': owner_name,
                'thumbnail': thumbnail_url,
                'image': thumbnail_url,
                'thumbnail_design_id': primary_design.id,
                'design_count': len(p_designs),
                'ui_score': ui_score,
                'ux_score': ux_score,
                'overall_score': overall_score,
                'like_count': all_likes_count,
                'is_liked': user_has_liked,
                'comment_count': comment_count,
                'created_at': p.created_at,
                'uploaded_at': primary_design.uploaded_at,
                'timestamp': p.created_at,
            })

        if sort == 'likes':
            items.sort(key=lambda x: (x['like_count'], x['timestamp']), reverse=True)
        elif sort == 'top_rated':
            items.sort(key=lambda x: (x['overall_score'], x['ui_score'], x['timestamp']), reverse=True)
        else:  # latest
            items.sort(key=lambda x: x['timestamp'], reverse=True)

        return Response(items[:60])



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
        from django.db.models import Q
        from .models import Friendship
        friendships = Friendship.objects.filter(Q(user_a=request.user) | Q(user_b=request.user))
        friend_ids = [f.user_b_id if f.user_a_id == request.user.id else f.user_a_id for f in friendships]

        design = Design.objects.filter(
            Q(id=pk) & (
                Q(is_public=True) |
                Q(project__is_public=True) |
                Q(project__user_id__in=friend_ids) |
                Q(project__user=request.user)
            )
        ).select_related('project').first()

        if not design:
            return Response({'detail': 'Design not found or not accessible.'}, status=status.HTTP_404_NOT_FOUND)

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
            has_content = (
                project.hybrid_submissions.filter(status='done').exists() or
                project.archives.filter(processed=True).exists() or
                project.designs.exists()
            )
            if not has_content:
                return Response(
                    {'detail': 'Please submit a project report or upload design screenshots before making the project public.'},
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
