from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class UsernameUniquenessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        print("\nUSERS IN DB BEFORE SETUP:", list(User.objects.values_list('username', flat=True)))
        User.objects.create_user(username='Alex', password='pass12345')

    def test_exact_duplicate_username_rejected(self):
        response = self.client.post('/api/register/', {
            'username': 'Alex',
            'password': 'pass12345',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.data)
        self.assertIn('already taken', response.data['username'][0].lower())

    def test_different_capitalization_allowed(self):
        response = self.client.post('/api/register/', {
            'username': 'alex',
            'password': 'pass12345',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username='alex').exists())

