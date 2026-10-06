# Import the path and include functions for URL routing
from django.urls import path, include
# Import the DefaultRouter from DRF which automatically generates URL patterns for ViewSets
from rest_framework.routers import DefaultRouter
# Import the custom views and viewsets that will handle the logic for our endpoints
from .views import (
    ProjectViewSet, DesignViewSet, AIFeedbackViewSet, RegisterView,
    ProjectReportPDFView, ArchiveUploadView, DeleteProjectFeedbackView,
    PrivacyPolicyView, DeleteAllUserDataView, CancelArchiveUploadView, HybridSubmissionCreateView,
)
from .portfolio_views import (
    ProfileSearchView, PublicProfileView, PublicProjectView,
    ProjectCommentListCreateView, OwnerProjectCommentsView,
    CommentReplyView, DesignLikeToggleView, MyProfileView, ProjectVisibilityView,
    PublicDesignsView,
)
from .social_views import (
    FriendshipViewSet, ChatViewSet, FeedView
)

# Initialize an instance of the DefaultRouter
router = DefaultRouter()

# Register the ProjectViewSet with the router. 
# This automatically creates routes like /projects/ (list/create) and /projects/<id>/ (retrieve/update/delete)
router.register(r'projects', ProjectViewSet, basename='project')

# Register the DesignViewSet with the router.
# This automatically creates routes like /designs/ and /designs/<id>/
router.register(r'designs', DesignViewSet, basename='design')

# Register the AIFeedbackViewSet with the router.
# This automatically creates routes like /feedback/ and /feedback/<id>/
router.register(r'feedback', AIFeedbackViewSet, basename='feedback')

# Define the url patterns that will be exposed by this Django app (feedback_app)
urlpatterns = [
    # Custom routes should be defined before router includes to avoid shadowing.
    path('projects/<int:pk>/feedback/', DeleteProjectFeedbackView.as_view(), name='delete-project-feedback'),
    path('register/', RegisterView.as_view(), name='register'),
    path('privacy/', PrivacyPolicyView.as_view(), name='privacy-policy'),
    path('account/delete-all-data/', DeleteAllUserDataView.as_view(), name='delete-all-user-data'),
    path('projects/<int:pk>/report/', ProjectReportPDFView.as_view(), name='project-report'),
    path('archives/', ArchiveUploadView.as_view(), name='archive-upload'),
    path('archives/<int:pk>/cancel/', CancelArchiveUploadView.as_view(), name='cancel-archive-upload'),
    path('hybrid-submissions/', HybridSubmissionCreateView.as_view(), name='hybrid-submissions'),
    path('explore/search/', ProfileSearchView.as_view(), name='profile-search'),
    path('portfolio/<str:username>/', PublicProfileView.as_view(), name='public-profile'),
    path('portfolio/<str:username>/projects/<int:project_id>/', PublicProjectView.as_view(), name='public-project'),
    path('portfolio/<str:username>/projects/<int:project_id>/comments/', ProjectCommentListCreateView.as_view(), name='public-project-comments'),
    path('projects/<int:pk>/visibility/', ProjectVisibilityView.as_view(), name='project-visibility'),
    path('projects/<int:pk>/comments/', OwnerProjectCommentsView.as_view(), name='owner-project-comments'),
    path('projects/<int:pk>/comments/<int:comment_id>/reply/', CommentReplyView.as_view(), name='comment-reply'),
    path('designs/<int:pk>/like/', DesignLikeToggleView.as_view(), name='design-like'),
    path('public-designs/', PublicDesignsView.as_view(), name='public-designs'),
    path('profile/me/', MyProfileView.as_view(), name='my-profile'),
    
    # Social Platform Routes
    path('feed/', FeedView.as_view(), name='activity-feed'),
    path('friends/', FriendshipViewSet.as_view({'get': 'list'}), name='friends-list'),
    path('friends/send/', FriendshipViewSet.as_view({'post': 'send_request'}), name='friends-send'),
    path('friends/requests/', FriendshipViewSet.as_view({'get': 'list_requests'}), name='friends-requests'),
    path('friends/respond/<int:pk>/', FriendshipViewSet.as_view({'post': 'respond_request'}), name='friends-respond'),
    path('friends/remove/<str:username>/', FriendshipViewSet.as_view({'delete': 'remove_friend'}), name='friends-remove'),
    path('chat/threads/', ChatViewSet.as_view({'get': 'list_threads'}), name='chat-threads'),
    path('chat/messages/<str:username>/', ChatViewSet.as_view({'get': 'get_messages'}), name='chat-messages'),
    path('chat/send/', ChatViewSet.as_view({'post': 'send_message'}), name='chat-send'),

    # Include all router-generated URLs after custom routes.
    path('', include(router.urls)),
]
