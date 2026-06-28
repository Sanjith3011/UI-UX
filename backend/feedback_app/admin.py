# Import the admin module from Django to customize the admin interface
from django.contrib import admin
# Import our custom models so we can register them with the admin site
from .models import Project, Design, AIFeedback

# Use a decorator to register the Project model with the admin site and attach the customizations below it
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    # Customize the columns displayed in the main list view for Projects
    list_display = ('title', 'created_at', 'updated_at')
    # Add a search box that allows filtering projects by their title
    search_fields = ('title',)

# Register the Design model with the admin site
@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    # Display the linked project and the upload date in the main list view for Designs
    list_display = ('project', 'uploaded_at')
    # Add a filter sidebar allowing admins to filter designs by the project they belong to
    list_filter = ('project',)

# Register the AIFeedback model with the admin site
@admin.register(AIFeedback)
class AIFeedbackAdmin(admin.ModelAdmin):
    # Display the linked design, both scores, and generation date in the list view
    list_display = ('design', 'ui_score', 'ux_score', 'generated_at')
    # Add a filter sidebar allowing admins to filter feedback entries by their UI or UX scores
    list_filter = ('ui_score', 'ux_score')
