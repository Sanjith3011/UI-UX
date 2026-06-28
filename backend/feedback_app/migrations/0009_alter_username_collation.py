from django.conf import settings
from django.db import migrations

def alter_username_collation(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(
            'ALTER TABLE auth_user ALTER COLUMN username TYPE varchar(150) COLLATE "C";'
        )

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('feedback_app', '0008_portfolio_platform'),
    ]

    operations = [
        migrations.RunPython(alter_username_collation, reverse_code=migrations.RunPython.noop),
    ]
