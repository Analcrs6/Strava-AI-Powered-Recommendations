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
  list: (skip = 0, limit = 20, includeDemo = false) => 
    api.get(`/activities?skip=${skip}&limit=${limit}&include_demo=${includeDemo}`),
  get: (id) => api.get(`/activities/${id}`),
  create: (data) => api.post('/activities', data),
};

export const recommendAPI = {
  getRecommendations: (activityId, k = 10, strategy = 'content_mmr', lambdaDiversity = 0.3, excludeSeen = false, userId = null) => 
    api.post('/recommend', { 
      activity_id: activityId, 
      k,
      strategy,
      lambda_diversity: lambdaDiversity,
      exclude_seen: excludeSeen,
      user_id: userId
    }),
  getNextActivity: (userId, topK = 10, strategy = 'content_mmr', lambdaDiversity = 0.3) =>
    api.post('/recommend/next-activity', null, {
      params: { user_id: userId, top_k: topK, strategy, lambda_diversity: lambdaDiversity }
    }),
  rebuildIndex: () => api.post('/recommend/rebuild'),
  getStrategies: () => api.get('/recommend/strategies'),
};

export const usersAPI = {
  list: (skip = 0, limit = 100) => api.get(`/users?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const demoAPI = {
  getUsers: () => api.get('/demo/users'),
  loadData: (userId) => api.post('/demo/load', { user_id: userId }),
  clearSession: (sessionId) => api.post('/demo/clear', { session_id: sessionId }),
  getStats: () => api.get('/demo/stats'),
  getActivities: (skip = 0, limit = 50, userId = null) => 
    api.get('/demo/activities', { params: { skip, limit, user_id: userId } }),
  getRecommendations: (activityId, k = 10, strategy = 'content_mmr', lambdaDiversity = 0.3, excludeSeen = false, userId = null) => 
    api.post('/demo/recommend', { 
      activity_id: activityId, 
      k,
      strategy,
      lambda_diversity: lambdaDiversity,
      exclude_seen: excludeSeen,
      user_id: userId
    }),
};

export const socialAPI = {
  getProfile: (userId, currentUserId = null) => 
    api.get(`/social/users/${userId}/profile`, { params: { current_user_id: currentUserId } }),
  getFollowers: (userId, skip = 0, limit = 50) =>
    api.get(`/social/users/${userId}/followers`, { params: { skip, limit } }),
  getFollowing: (userId, skip = 0, limit = 50) =>
    api.get(`/social/users/${userId}/following`, { params: { skip, limit } }),
  follow: (userId, targetUserId) =>
    api.post('/social/follow', { user_id: userId, target_user_id: targetUserId }),
  unfollow: (userId, targetUserId) =>
    api.post('/social/unfollow', { user_id: userId, target_user_id: targetUserId }),
  getSuggestions: (userId, limit = 10) =>
    api.get('/social/suggestions', { params: { user_id: userId, limit } }),
  updateProfile: (userId, data) =>
    api.put(`/social/users/${userId}/profile`, null, { params: data }),
};

export const locationAPI = {
  updateLocation: (userId, latitude, longitude, sharingEnabled = true, accuracy = null, source = null, altitude = null, speed = null, heading = null) =>
    api.post('/location/update', { 
      user_id: userId, 
      latitude, 
      longitude, 
      sharing_enabled: sharingEnabled,
      accuracy,
      source,
      altitude,
      speed,
      heading
    }),
  getMutualFollowersLocations: (userId, maxDistanceMeters = 50000, useVincenty = true) =>
    api.get(`/location/mutual-followers/${userId}`, { 
      params: { 
        max_distance_meters: maxDistanceMeters,
        use_vincenty: useVincenty
      } 
    }),
  checkProximityNotifications: (userId, proximityThresholdMeters = 500) =>
    api.get(`/location/proximity-check/${userId}`, { 
      params: { 
        proximity_threshold_meters: proximityThresholdMeters
      } 
    }),
  toggleLocationSharing: (userId, enabled) =>
    api.post(`/location/toggle-sharing/${userId}`, null, { params: { enabled } }),
};

export default api;

