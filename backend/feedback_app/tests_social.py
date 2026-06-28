from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Friendship, FriendRequest, ChatMessage, Project


class SocialPlatformTests(APITestCase):

    def setUp(self):
        # Create test users
        self.user_a = User.objects.create_user(username='usera', password='password123')
        self.user_b = User.objects.create_user(username='userb', password='password123')
        self.user_c = User.objects.create_user(username='userc', password='password123')

    def test_friend_request_flow(self):
        # Authenticate User A
        self.client.force_authenticate(user=self.user_a)

        # Send friend request A -> B
        response = self.client.post(reverse('friends-send'), {'username': 'userb'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(FriendRequest.objects.filter(sender=self.user_a, receiver=self.user_b).exists())

        # Try sending request to self
        response = self.client.post(reverse('friends-send'), {'username': 'usera'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Authenticate User B
        self.client.force_authenticate(user=self.user_b)

        # List incoming requests
        response = self.client.get(reverse('friends-requests'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['sender'], 'usera')

        req_id = response.data[0]['id']

        # Accept friend request
        response = self.client.post(reverse('friends-respond', args=[req_id]), {'action': 'accept'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify friendship exists
        self.assertTrue(Friendship.objects.filter(user_a=self.user_a, user_b=self.user_b).exists() or 
                        Friendship.objects.filter(user_a=self.user_b, user_b=self.user_a).exists())
        self.assertFalse(FriendRequest.objects.filter(id=req_id).exists())

        # List friends
        response = self.client.get(reverse('friends-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'usera')

    def test_chat_blocked_between_non_friends(self):
        # Authenticate User A
        self.client.force_authenticate(user=self.user_a)

        # Try sending message to B (not friends yet)
        response = self.client.post(reverse('chat-send'), {'username': 'userb', 'body': 'Hello!'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try reading chat messages
        response = self.client.get(reverse('chat-messages', args=['userb']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_chat_allowed_between_friends(self):
        # Create friendship between A and B
        user_a_first, user_b_first = sorted([self.user_a, self.user_b], key=lambda u: u.id)
        Friendship.objects.create(user_a=user_a_first, user_b=user_b_first)

        # Authenticate User A
        self.client.force_authenticate(user=self.user_a)

        # Send message A -> B
        response = self.client.post(reverse('chat-send'), {'username': 'userb', 'body': 'Hello friend!'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['body'], 'Hello friend!')

        # Authenticate User B
        self.client.force_authenticate(user=self.user_b)

        # Get message history
        response = self.client.get(reverse('chat-messages', args=['usera']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['body'], 'Hello friend!')
        self.assertEqual(response.data[0]['sender'], 'usera')

    def test_general_feed_visibility(self):
        # Create a public project for User A
        project_a = Project.objects.create(user=self.user_a, title="Project A", description="Awesome", is_public=True)
        # Create a private project for User B
        project_b = Project.objects.create(user=self.user_b, title="Project B", description="Private", is_public=False)

        # Authenticate User C (no friends)
        self.client.force_authenticate(user=self.user_c)

        # Fetch feed
        response = self.client.get(reverse('activity-feed'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify C only sees public project A
        feed_titles = [item['title'] for item in response.data]
        self.assertTrue(any("Project A" in t for t in feed_titles))
        self.assertFalse(any("Project B" in t for t in feed_titles))

        # Make C and B friends
        user_b_first, user_c_first = sorted([self.user_b, self.user_c], key=lambda u: u.id)
        Friendship.objects.create(user_a=user_b_first, user_b=user_c_first)

        # Fetch feed again
        response = self.client.get(reverse('activity-feed'))
        # C should now see private project B because they are friends with B
        feed_titles = [item['title'] for item in response.data]
        self.assertTrue(any("Project B" in t for t in feed_titles))
