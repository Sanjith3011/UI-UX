# Import serializers from DRF to handle converting complex data types (models) to Python native datatypes
from rest_framework import serializers
# Import our custom models
from .models import DesignShare, ProjectArchive, Design, AIFeedback, Project
class DesignShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignShare
        fields = ['id', 'token', 'expires_at', 'created_at']

class ProjectArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectArchive
        fields = ['id', 'project', 'zip_file', 'uploaded_at', 'processed', 'error_message', 'zip_hash', 'analysis', 'project_feedback']

# Import the built-in Django User model
from django.contrib.auth.models import User

# Define a serializer for the User model, used for registration and returning user details
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        # Specify the model to serialize
        model = User
        # Define the fields from the User model that will be included in the serialized output/input
        fields = ('id', 'username', 'password', 'email')
        # Add extra configuration for specific fields
        # 'write_only': True ensures the password is never returned in the API response
        extra_kwargs = {
            'password': {'write_only': True},
            'username': {
                'validators': [],
            },
        }

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError('Username cannot be empty.')
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError(
                'This username is already taken. Please choose a different username.'
            )
        return username

    # Override the default create method to handle secure password hashing
    def create(self, validated_data):
        # Use create_user instead of create so Django automatically hashes the password
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''), # Fallback to empty string if email is missing
            password=validated_data['password']
        )
        return user

# Define a serializer for the AIFeedback model
class AIFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        # Specify the model
        model = AIFeedback
        # Expose all fields to the frontend
        fields = ('raw_analysis', 'ui_score', 'ux_score', 'generated_at')

# Define a serializer for the Design model
class DesignSerializer(serializers.ModelSerializer):
    feedback = AIFeedbackSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = ['id', 'project', 'image', 'uploaded_at', 'is_public', 'feedback', 'like_count']

    def get_like_count(self, obj):
        return obj.likes.count()

# Define a serializer for the Project model
class ProjectSerializer(serializers.ModelSerializer):
    # Nest the DesignSerializer to include a list of all designs associated with this project.
    # many=True indicates there can be multiple designs.
    # read_only=True means we don't accept design data when creating/updating the project itself.
    designs = DesignSerializer(many=True, read_only=True)
    
    # Define a custom, read-only field to return the user's username instead of their user ID
    # source='user.username' traverses the relationships: Project -> User -> username
    user = serializers.ReadOnlyField(source='user.username')
    project_feedback = serializers.SerializerMethodField()
    archive_status = serializers.SerializerMethodField()
    archive_error = serializers.SerializerMethodField()
    archive_progress = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    def get_comment_count(self, obj):
        return obj.comments.filter(parent__isnull=True).count()

    def get_project_feedback(self, obj):
        """
        Retrieve the latest processed archive's project_feedback for the given project.
        """
        from .models import ProjectArchive
        archive = ProjectArchive.objects.filter(project=obj, processed=True).order_by('-uploaded_at').first()
        return archive.project_feedback if archive else None

    def get_archive_status(self, obj):
        archive = ProjectArchive.objects.filter(project=obj).order_by('-uploaded_at').first()
        if not archive:
            return None
        if archive.processed:
            return 'ready'
        if archive.error_message:
            return 'failed'
        return 'processing'

    def get_archive_error(self, obj):
        archive = ProjectArchive.objects.filter(project=obj, processed=False).order_by('-uploaded_at').first()
        return archive.error_message if archive and archive.error_message else None

    def get_archive_progress(self, obj):
        archive = ProjectArchive.objects.filter(project=obj, processed=False).order_by('-uploaded_at').first()
        if not archive or not archive.processing_progress:
            return None
        return archive.processing_progress

    def validate(self, attrs):
        is_public = attrs.get('is_public')
        if is_public:
            if not self.instance:
                raise serializers.ValidationError(
                    {"is_public": "You cannot make this project public before uploading and processing a project ZIP archive."}
                )
            else:
                has_archive = self.instance.archives.filter(processed=True).exists()
                if not has_archive:
                    raise serializers.ValidationError(
                        {"is_public": "You cannot make this project public before uploading and processing a project ZIP archive."}
                    )
        return attrs

    def update(self, instance, validated_data):
        is_public = validated_data.get('is_public')
        instance = super().update(instance, validated_data)
        if 'is_public' in validated_data:
            instance.designs.update(is_public=is_public)
        return instance

    latest_archive_id = serializers.SerializerMethodField()

    def get_latest_archive_id(self, obj):
        from .models import ProjectArchive
        archive = ProjectArchive.objects.filter(project=obj, processed=False).order_by('-uploaded_at').first()
        return archive.id if archive else None

    class Meta:
        model = Project
        fields = [
            'id', 'user', 'title', 'description', 'is_public', 'created_at', 'updated_at',
            'designs', 'project_feedback', 'archive_status', 'archive_error', 'archive_progress',
            'comment_count', 'latest_archive_id',
        ]


