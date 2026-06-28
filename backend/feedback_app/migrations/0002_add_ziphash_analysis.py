from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('feedback_app', '0001_initial'),
    ]
    operations = [
        migrations.AddField(
            model_name='projectarchive',
            name='zip_hash',
            field=models.CharField(max_length=64, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='projectarchive',
            name='analysis',
            field=models.JSONField(null=True, blank=True),
        ),
    ]
