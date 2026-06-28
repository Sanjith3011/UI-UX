import os
import sys
import django
from django.test import Client

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

client = Client()
response = client.post('/api/register/', {'username': 'testuser', 'password': 'testpassword'}, content_type='application/json')
print("Status 1:", response.status_code)
print("Content 1:", response.content.decode('utf-8'))

response2 = client.post('/api/register/', {'username': 'testuser', 'password': 'testpassword'}, content_type='application/json')
print("Status 2:", response2.status_code)
print("Content 2:", response2.content.decode('utf-8'))
