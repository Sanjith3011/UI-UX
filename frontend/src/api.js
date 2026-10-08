import axios from 'axios';

const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const MEDIA_BASE = RAW_BACKEND_URL.replace(/\/+$/, '');

const api = axios.create({
    baseURL: `${MEDIA_BASE}/api/`,
});

api.interceptors.request.use(
    (config) => {
        const stored = localStorage.getItem('authTokens');
        if (stored) {
            try {
                const tokens = JSON.parse(stored);
                if (tokens && tokens.access) {
                    config.headers['Authorization'] = `Bearer ${tokens.access}`;
                }
            } catch (e) {
                console.warn('Failed to parse authTokens from localStorage');
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;

export const downloadProjectReport = (projectId) => {
  return api
    .get(`projects/${projectId}/report/`, { responseType: 'blob' })
    .then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_${projectId}_report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
};

export const MAX_ZIP_UPLOAD_MB = 200;

export const uploadProjectArchive = (projectId, zipFile) => {
  const formData = new FormData();
  formData.append('zip_file', zipFile);
  formData.append('project', projectId);
  return api.post('archives/', formData, {
    timeout: 300000,
    validateStatus: (status) => status === 201 || status === 202,
  });
};

export const fetchPrivacyPolicy = () =>
  api.get('privacy/').then((res) => res.data);

export const deleteAllUserData = () =>
  api.delete('account/delete-all-data/');

// Portfolio platform
export const searchProfiles = (query) =>
  api.get('explore/search/', { params: { q: query } }).then((res) => res.data);

export const fetchPublicProfile = (username) =>
  api.get(`portfolio/${username}/`).then((res) => res.data);

export const fetchPublicProject = (username, projectId) =>
  api.get(`portfolio/${username}/projects/${projectId}/`).then((res) => res.data);

export const fetchPublicComments = (username, projectId) =>
  api.get(`portfolio/${username}/projects/${projectId}/comments/`).then((res) => res.data);

export const postPublicComment = (username, projectId, body) =>
  api.post(`portfolio/${username}/projects/${projectId}/comments/`, { body });

export const fetchOwnerComments = (projectId) =>
  api.get(`projects/${projectId}/comments/`).then((res) => res.data);

export const postOwnerReply = (projectId, commentId, body) =>
  api.post(`projects/${projectId}/comments/${commentId}/reply/`, { body });

export const toggleDesignLike = (designId) =>
  api.post(`designs/${designId}/like/`).then((res) => res.data);

export const updateProjectVisibility = (projectId, isPublic) =>
  api.patch(`projects/${projectId}/visibility/`, { is_public: isPublic }).then((res) => res.data);

export const updateDesignVisibility = (designId, isPublic) =>
  api.patch(`designs/${designId}/`, { is_public: isPublic });

export const fetchMyProfile = () =>
  api.get('profile/me/').then((res) => res.data);

export const updateMyProfile = (data) =>
  api.patch('profile/me/', data).then((res) => res.data);

// Social endpoints
export const fetchFeed = () =>
  api.get('feed/').then((res) => res.data);

export const fetchPublicDesigns = (params = {}) =>
  api.get('public-designs/', { params }).then((res) => res.data);

export const fetchFriends = () =>
  api.get('friends/').then((res) => res.data);

export const sendFriendRequest = (username) =>
  api.post('friends/send/', { username }).then((res) => res.data);

export const fetchFriendRequests = () =>
  api.get('friends/requests/').then((res) => res.data);

export const respondToFriendRequest = (requestId, action) =>
  api.post(`friends/respond/${requestId}/`, { action }).then((res) => res.data);

export const removeFriend = (username) =>
  api.delete(`friends/remove/${username}/`).then((res) => res.data);

export const fetchChatThreads = () =>
  api.get('chat/threads/').then((res) => res.data);

export const fetchChatMessages = (username) =>
  api.get(`chat/messages/${username}/`).then((res) => res.data);

export const sendChatMessage = (username, body) =>
  api.post('chat/send/', { username, body }).then((res) => res.data);

export const cancelArchiveUpload = (archiveId) =>
  api.post(`archives/${archiveId}/cancel/`).then((res) => res.data);


export const createHybridSubmission = (formData) =>
  api.post('hybrid-submissions/', formData).then((res) => res.data);

export const fetchHybridSubmissions = (projectId) =>
  api.get('hybrid-submissions/', { params: projectId ? { project: projectId } : {} }).then((res) => res.data);

