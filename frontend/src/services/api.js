import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthAPI = {
  check: () => api.get('/health/live'),
};

export const activitiesAPI = {
  list: (skip = 0, limit = 20) => api.get(`/activities?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`/activities/${id}`),
  create: (data) => api.post('/activities', data),
};

export const recommendAPI = {
  getRecommendations: (activityId, k = 10, strategy = 'content_mmr', lambdaDiversity = 0.3) => 
    api.post('/recommend', { 
      activity_id: activityId, 
      k,
      strategy,
      lambda_diversity: lambdaDiversity
    }),
  rebuildIndex: () => api.post('/recommend/rebuild'),
  getStrategies: () => api.get('/recommend/strategies'),
};

export const usersAPI = {
  list: (skip = 0, limit = 100) => api.get(`/users?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
};

export default api;

