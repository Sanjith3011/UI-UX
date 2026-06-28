from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('feedback_app', '0006_projectarchive_project_feedback'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectarchive',
            name='processing_progress',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
