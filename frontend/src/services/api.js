import axios from 'axios'
const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  seed: () => api.post('/auth/seed'),
}
export const incidentsAPI = {
  dashboard: () => api.get('/incidents/dashboard'),
  list: (params, config) => api.get('/incidents', { params, ...config }),
  get: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.put(`/incidents/${id}`, data),
  delete: (id) => api.delete(`/incidents/${id}`),
  exportCSV: (params) => api.get('/incidents/export', { params, responseType: 'blob' }),
}
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, data) => api.put(`/users/${id}/reset-password`, data),
  delete: (id) => api.delete(`/users/${id}`),
}
export const auditAPI = {
  list: (params) => api.get('/audit-logs', { params }),
  users: () => api.get('/audit-logs/users'),
}