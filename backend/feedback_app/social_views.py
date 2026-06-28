from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Friendship, FriendRequest, ChatMessage, Project, ProjectArchive, DesignLike, ProjectComment
from .serializers import UserSerializer


# --- SERIALIZERS ---
from rest_framework import serializers

class FriendRequestSerializer(serializers.ModelSerializer):
    sender = serializers.ReadOnlyField(source='sender.username')
    receiver = serializers.ReadOnlyField(source='receiver.username')

    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'receiver', 'created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = serializers.ReadOnlyField(source='sender.username')
    receiver = serializers.ReadOnlyField(source='receiver.username')

    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'receiver', 'body', 'created_at']


# --- VIEWS ---

class FriendshipViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """GET /api/friends/ - List current friends"""
        user = request.user
        friendships = Friendship.objects.filter(Q(user_a=user) | Q(user_b=user)).select_related('user_a__profile', 'user_b__profile')
        friends_list = []
        for f in friendships:
            friend = f.user_b if f.user_a == user else f.user_a
            friends_list.append({
                'username': friend.username,
                'bio': getattr(friend, 'profile', None).bio if hasattr(friend, 'profile') else '',
                'portfolio_public': getattr(friend, 'profile', None).portfolio_public if hasattr(friend, 'profile') else True,
            })
        return Response(friends_list)

    def send_request(self, request):
        """POST /api/friends/send/ - Send a friend request by username"""
        username = request.data.get('username', '').strip()
        if not username:
            return Response({'detail': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if username == request.user.username:
            return Response({'detail': 'You cannot send a friend request to yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receiver = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check if already friends
        user_a, user_b = sorted([request.user, receiver], key=lambda u: u.id)
        if Friendship.objects.filter(user_a=user_a, user_b=user_b).exists():
            return Response({'detail': 'You are already friends with this user.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if request already exists
        if FriendRequest.objects.filter(
            Q(sender=request.user, receiver=receiver) | Q(sender=receiver, receiver=request.user)
        ).exists():
            return Response({'detail': 'A pending friend request already exists between you.'}, status=status.HTTP_400_BAD_REQUEST)

        req = FriendRequest.objects.create(sender=request.user, receiver=receiver)
        return Response(FriendRequestSerializer(req).data, status=status.HTTP_201_CREATED)

    def list_requests(self, request):
        """GET /api/friends/requests/ - List incoming pending requests"""
        reqs = FriendRequest.objects.filter(receiver=request.user).select_related('sender')
        return Response(FriendRequestSerializer(reqs, many=True).data)

    def respond_request(self, request, pk=None):
        """POST /api/friends/respond/<id>/ - Accept or reject a request"""
        try:
            req = FriendRequest.objects.get(id=pk, receiver=request.user)
        except FriendRequest.DoesNotExist:
            return Response({'detail': 'Friend request not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', '').strip().lower()
        if action == 'accept':
            # Create friendship
            user_a, user_b = sorted([req.sender, req.receiver], key=lambda u: u.id)
            Friendship.objects.get_or_create(user_a=user_a, user_b=user_b)
            req.delete()
            return Response({'detail': 'Friend request accepted.'})
        elif action == 'reject':
            req.delete()
            return Response({'detail': 'Friend request rejected.'})
        else:
            return Response({'detail': 'Invalid action. Specify accept or reject.'}, status=status.HTTP_400_BAD_REQUEST)

    def remove_friend(self, request, username=None):
        """DELETE /api/friends/remove/<username>/ - Remove a friend connection"""
        try:
            friend = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_444_NOT_FOUND if hasattr(status, 'HTTP_444_NOT_FOUND') else 404)

        user_a, user_b = sorted([request.user, friend], key=lambda u: u.id)
        deleted_count, _ = Friendship.objects.filter(user_a=user_a, user_b=user_b).delete()
        if deleted_count > 0:
            # Also clean up any active chats if desired, or keep them
            return Response({'detail': f'Removed friendship with {username}.'})
        return Response({'detail': 'Friendship connection not found.'}, status=status.HTTP_404_NOT_FOUND)


class ChatViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _is_friend(self, user1, user2):
        user_a, user_b = sorted([user1, user2], key=lambda u: u.id)
        return Friendship.objects.filter(user_a=user_a, user_b=user_b).exists()

    def list_threads(self, request):
        """GET /api/chat/threads/ - List users with active chat history"""
        user = request.user
        # Find all unique message senders or receivers for current user
        msgs = ChatMessage.objects.filter(Q(sender=user) | Q(receiver=user)).order_by('-created_at')
        partners = {}
        for m in msgs:
            partner = m.receiver if m.sender == user else m.sender
            if partner.username not in partners:
                partners[partner.username] = {
                    'username': partner.username,
                    'last_message': m.body,
                    'timestamp': m.created_at,
                    'is_friend': self._is_friend(user, partner),
                }
        
        # Ensure current friends who have no chat messages are also listed or easily selectable
        friendships = Friendship.objects.filter(Q(user_a=user) | Q(user_b=user))
        for f in friendships:
            friend = f.user_b if f.user_a == user else f.user_a
            if friend.username not in partners:
                partners[friend.username] = {
                    'username': friend.username,
                    'last_message': 'No messages yet.',
                    'timestamp': f.created_at,
                    'is_friend': True,
                }

        # Return sorted by timestamp desc
        sorted_threads = sorted(partners.values(), key=lambda t: t['timestamp'], reverse=True)
        return Response(sorted_threads)

    def get_messages(self, request, username=None):
        """GET /api/chat/messages/<username>/ - Get messaging history"""
        try:
            partner = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce friendship check before allowing chat
        if not self._is_friend(request.user, partner):
            return Response({'detail': 'You can only message users who are your friends.'}, status=status.HTTP_403_FORBIDDEN)

        msgs = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=partner) | Q(sender=partner, receiver=request.user)
        ).order_by('created_at')
        return Response(ChatMessageSerializer(msgs, many=True).data)

    def send_message(self, request):
        """POST /api/chat/send/ - Send a direct chat message"""
        username = request.data.get('username', '').strip()
        body = request.data.get('body', '').strip()
        if not username or not body:
            return Response({'detail': 'username and body are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receiver = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce friendship check before sending message
        if not self._is_friend(request.user, receiver):
            return Response({'detail': 'You can only message users who are your friends.'}, status=status.HTTP_403_FORBIDDEN)

        msg = ChatMessage.objects.create(sender=request.user, receiver=receiver, body=body)
        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class FeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """GET /api/feed/ - General activity feed"""
        user = request.user
        
        # 1. Get user's friends list
        friendships = Friendship.objects.filter(Q(user_a=user) | Q(user_b=user))
        friends = [f.user_b if f.user_a == user else f.user_a for f in friendships]
        friend_ids = [friend.id for friend in friends]
        
        # 2. Collect Feed Items:
        feed_items = []

        # A. Projects: Public projects, or any projects created by friends
        projects = Project.objects.filter(
            Q(is_public=True) | Q(user_id__in=friend_ids) | Q(user=user)
        ).select_related('user').order_by('-created_at')[:30]

        for p in projects:
            feed_items.append({
                'type': 'project_created',
                'username': p.user.username if p.user else 'Anonymous',
                'owner_username': p.user.username if p.user else 'Anonymous',
                'timestamp': p.created_at,
                'title': f"created a new project: {p.title}",
                'details': p.description[:120] + '...' if len(p.description) > 120 else p.description,
                'project_id': p.id,
            })

        # B. ZIP Uploads: Archives uploaded for these projects
        archives = ProjectArchive.objects.filter(
            Q(project__is_public=True) | Q(project__user_id__in=friend_ids) | Q(project__user=user)
        ).select_related('project__user').order_by('-uploaded_at')[:30]

        for a in archives:
            feed_items.append({
                'type': 'zip_uploaded',
                'username': a.project.user.username if a.project.user else 'Anonymous',
                'owner_username': a.project.user.username if a.project.user else 'Anonymous',
                'timestamp': a.uploaded_at,
                'title': f"uploaded a new codebase ZIP for: {a.project.title}",
                'details': f"Analysis completed: {a.processed}. UI Score: {a.project_feedback.get('ui_score') if a.project_feedback else 0}/10",
                'project_id': a.project.id,
            })

        # C. Comments on projects
        comments = ProjectComment.objects.filter(
            Q(project__is_public=True) | Q(project__user_id__in=friend_ids) | Q(project__user=user)
        ).select_related('author', 'project__user').order_by('-created_at')[:30]

        for c in comments:
            feed_items.append({
                'type': 'comment_added',
                'username': c.author.username,
                'owner_username': c.project.user.username if c.project.user else 'Anonymous',
                'timestamp': c.created_at,
                'title': f"commented on project: {c.project.title}",
                'details': c.body[:120] + '...' if len(c.body) > 120 else c.body,
                'project_id': c.project.id,
            })

        # D. Likes
        likes = DesignLike.objects.filter(
            Q(design__project__is_public=True) | Q(design__project__user_id__in=friend_ids) | Q(design__project__user=user)
        ).select_related('user', 'design__project__user').order_by('-created_at')[:30]

        for l in likes:
            feed_items.append({
                'type': 'design_liked',
                'username': l.user.username,
                'owner_username': l.design.project.user.username if l.design.project.user else 'Anonymous',
                'timestamp': l.created_at,
                'title': f"liked a page mockup in project: {l.design.project.title}",
                'details': f"Generated design ID: {l.design.id}",
                'project_id': l.design.project.id,
            })

        # Sort all feed items by timestamp descending
        sorted_feed = sorted(feed_items, key=lambda item: item['timestamp'], reverse=True)[:50]
        return Response(sorted_feed)
