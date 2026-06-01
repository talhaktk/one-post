import axios from 'axios'
import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || err)
)

// Video
export const uploadVideo = (formData, onProgress) =>
  api.post('/video/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total))
  })

export const processVideo = (videoId, options) =>
  api.post('/video/process', { video_id: videoId, ...options })

// Hashtags
export const fetchTrendingHashtags = () => api.get('/hashtags/trending')
export const fetchAIHashtags = (title, description, category) =>
  api.post('/hashtags/ai-suggest', { title, description, category })

// Publish
export const publishPost = (payload) => api.post('/publish', payload)
export const getPublishProgress = (jobId) => new EventSource(`${API_BASE}/publish/progress/${jobId}`)
export const getPublishStatus = (videoId) => api.get(`/publish/status/${videoId}`)
export const getServerHealth = () => api.get('/health')

// Posts history
export const getPosts = (userId) => api.get(`/posts/${userId}`)
export const rePost = (postId) => api.post(`/posts/${postId}/repost`)

// Accounts
export const getFacebookPages = (userId) => api.get(`/facebook-pages/${userId}`)
export const getTikTokAccounts = (userId) => api.get(`/tiktok-accounts/${userId}`)
export const disconnectAccount = (accountId) => api.delete(`/accounts/${accountId}`)
export const syncFacebookPages = (userId) => api.post(`/accounts/facebook/sync-pages`, { user_id: userId })
export const diagnoseFacebook = () => api.get(`/accounts/facebook/diagnose`)

// OAuth helpers
export const getOAuthUrl = (platform, userId) =>
  api.get(`/auth/oauth-url/${platform}`, { params: { user_id: userId } })
export const handleOAuthCallback = (platform, code, state) =>
  api.post(`/auth/oauth-callback/${platform}`, { code, state })

// News (Module A)
export const getBreakingAlerts = (filters) => api.get('/news/alerts', { params: filters })
export const postAlert = (alertId, platforms) => api.post(`/news/alerts/${alertId}/post`, { platforms })
export const dismissAlert = (alertId) => api.post(`/news/alerts/${alertId}/dismiss`)
export const regenerateCaption = (alertId) => api.post(`/news/alerts/${alertId}/regenerate-caption`)
export const updateAlertThumbnail = (alertId, formData) =>
  api.post(`/news/alerts/${alertId}/thumbnail`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getNewsSources = () => api.get('/news/sources')
export const updateNewsSource = (id, data) => api.patch(`/news/sources/${id}`, data)
export const getNewsKeywords = () => api.get('/news/keywords')
export const addNewsKeyword = (data) => api.post('/news/keywords', data)
export const deleteNewsKeyword = (id) => api.delete(`/news/keywords/${id}`)

// Schedule (Module B)
export const createScheduledPost = (data) => api.post('/schedule/create', data)
export const getScheduledPosts = (filters) => api.get('/schedule/posts', { params: filters })
export const getScheduleCalendar = () => api.get('/schedule/calendar')
export const updateScheduledPost = (id, data) => api.patch(`/schedule/posts/${id}`, data)
export const cancelScheduledPost = (id) => api.delete(`/schedule/posts/${id}`)
export const publishNow = (id) => api.post(`/schedule/posts/${id}/publish-now`)
export const reschedulePost = (id, scheduledAt) => api.post(`/schedule/posts/${id}/reschedule`, { scheduled_at: scheduledAt })
export const getScheduleResults = (id) => api.get(`/schedule/posts/${id}/results`)

export default api
