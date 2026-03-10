import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cs_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ──────────────────────────────────
export const authAPI = {
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

// ─── Rooms ─────────────────────────────────
export const roomsAPI = {
  create: (data) => api.post('/api/rooms', data),
  list: () => api.get('/api/rooms'),
  get: (slug) => api.get(`/api/rooms/${slug}`),
  update: (slug, data) => api.patch(`/api/rooms/${slug}`, data),
  delete: (slug) => api.delete(`/api/rooms/${slug}`),
  join: (slug) => api.post(`/api/rooms/${slug}/join`),
  messages: (slug, params) => api.get(`/api/rooms/${slug}/messages`, { params }),
  snapshots: (slug) => api.get(`/api/rooms/${slug}/snapshots`),
  saveSnapshot: (slug, data) => api.post(`/api/rooms/${slug}/snapshots`, data),
  commits: (slug) => api.get(`/api/rooms/${slug}/commits`),
};

// ─── GitHub ────────────────────────────────
export const githubAPI = {
  repos: () => api.get('/api/github/repos'),
  branches: (owner, repo) => api.get(`/api/github/repos/${owner}/${repo}/branches`),
  push: (slug, data) => api.post(`/api/github/push/${slug}`, data),
};

// ─── Execute ───────────────────────────────
export const executeAPI = {
  run: (data) => api.post('/api/execute', data),
};
