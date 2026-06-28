# feedback_app/permissions.py
from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """Object-level permission to only allow owners of a project to edit/delete designs."""

    def has_object_permission(self, request, view, obj):
        # obj is a Design instance; ensure its project belongs to the requesting user
        return obj.project.user == request.user
