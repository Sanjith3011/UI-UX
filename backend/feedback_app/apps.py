import logging

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class FeedbackAppConfig(AppConfig):
    name = 'feedback_app'

    def ready(self):
        import feedback_app.signals  # noqa: F401
        if getattr(settings, 'AI_PROVIDER', 'groq') == 'groq' and not getattr(settings, 'GROQ_ZDR_ENABLED', False):
            logger.warning(
                'GROQ_ZDR_ENABLED is false. Enable Zero Data Retention at '
                'https://console.groq.com/settings/data-controls then set GROQ_ZDR_ENABLED=true in .env'
            )
