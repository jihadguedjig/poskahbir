import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/** Full URL for product images (backend serves /uploads from API origin) */
export const getProductImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  const backendOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  return backendOrigin ? `${backendOrigin}${url}` : url
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token; allow FormData to set its own Content-Type
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // FormData must set Content-Type with boundary; don't send application/json
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data
    const message =
      data?.error?.message ||
      data?.message ||
      (error.code === 'ECONNABORTED' ? 'Request timed out' : null) ||
      (error.message === 'Network Error' ? 'Connection error. Check your network.' : null) ||
      'Something went wrong. Please try again.'

    // Handle 401 - session expired or invalid token
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        toast.error('Session expired. Please log in again.')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // Don't show toast for login errors - AuthContext shows its own message
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    if (!isLoginRequest) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

// =====================
// AUTH API
// =====================
export const authAPI = {
  getLoginOptions: () =>
    api.get('/auth/login-options'),
  login: (username, pin) =>
    api.post('/auth/login', { username, pin }),
  
  verify: () => 
    api.get('/auth/verify'),
  
  updateProfile: (fullName) => 
    api.patch('/auth/profile', { full_name: fullName }),
  
  changePin: (currentPin, newPin) => 
    api.post('/auth/change-pin', { currentPin, newPin }),
  
  logout: () => 
    api.post('/auth/logout'),
}

// =====================
// TABLES API
// =====================
export const tablesAPI = {
  getAll: (params = {}) => 
    api.get('/tables', { params }),
  
  getById: (id) => 
    api.get(`/tables/${id}`),
  
  getByNumber: (tableNumber) => 
    api.get(`/tables/number/${tableNumber}`),
  
  getSummary: () => 
    api.get('/tables/summary'),
  
  getSections: () => 
    api.get('/tables/sections'),
  
  create: (data) => 
    api.post('/tables', data),
  
  update: (id, data) => 
    api.put(`/tables/${id}`, data),
  
  delete: (id) => 
    api.delete(`/tables/${id}`),
  
  lock: (id) => 
    api.post(`/tables/${id}/lock`),
  
  unlock: (id) => 
    api.post(`/tables/${id}/unlock`),
  
  updateStatus: (id, status) => 
    api.patch(`/tables/${id}/status`, { status }),
}

// =====================
// ORDERS API
// =====================
export const ordersAPI = {
  getAll: (params = {}) => 
    api.get('/orders', { params }),
  
  getActive: () => 
    api.get('/orders/active'),
  
  getById: (id) => 
    api.get(`/orders/${id}`),
  
  create: (data) => 
    api.post('/orders', data),
  
  update: (id, data) => 
    api.patch(`/orders/${id}`, data),
  
  addItem: (orderId, data) => 
    api.post(`/orders/${orderId}/items`, data),
  
  updateItem: (orderId, itemId, data) => 
    api.patch(`/orders/${orderId}/items/${itemId}`, data),
  
  removeItem: (orderId, itemId) => 
    api.delete(`/orders/${orderId}/items/${itemId}`),
  
  cancel: (id, reason) => 
    api.post(`/orders/${id}/cancel`, { reason }),
}

// =====================
// PRODUCTS API
// =====================
export const productsAPI = {
  getAll: (params = {}) => 
    api.get('/products', { params }),
  
  getByCategory: () => 
    api.get('/products/by-category'),
  
  getById: (id) => 
    api.get(`/products/${id}`),
  
  create: (data) => 
    api.post('/products', data),
  
  update: (id, data) => 
    api.put(`/products/${id}`, data),
  
  toggleAvailability: (id, isAvailable) => 
    api.patch(`/products/${id}/availability`, { is_available: isAvailable }),
  
  updateStock: (id, data) => 
    api.patch(`/products/${id}/stock`, data),
  
  delete: (id) => 
    api.delete(`/products/${id}`),
  
  getLowStock: () => 
    api.get('/products/low-stock'),
}

// =====================
// UPLOADS API
// =====================
export const uploadsAPI = {
  uploadProductImage: (file) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post('/uploads/product-image', formData)
  },
  uploadCategoryImage: (file) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post('/uploads/category-image', formData)
  }
}

// =====================
// CATEGORIES API
// =====================
export const categoriesAPI = {
  getAll: (params = {}) => 
    api.get('/products/categories', { params }),
  
  getById: (id) => 
    api.get(`/products/categories/${id}`),
  
  create: (data) => 
    api.post('/products/categories', data),
  
  update: (id, data) => 
    api.put(`/products/categories/${id}`, data),
  
  delete: (id) => 
    api.delete(`/products/categories/${id}`),
}

// =====================
// PAYMENTS API
// =====================
export const paymentsAPI = {
  getMethods: (params = {}) => 
    api.get('/payments/methods', { params }),
  
  getAll: (params = {}) => 
    api.get('/payments', { params }),
  
  getById: (id) => 
    api.get(`/payments/${id}`),
  
  process: (data) => 
    api.post('/payments', data),
  
  getDailySummary: (date) => 
    api.get('/payments/summary/daily', { params: { date } }),
  
  getReport: (startDate, endDate) => 
    api.get('/payments/report', { params: { start_date: startDate, end_date: endDate } }),
}

// Payment methods management (admin)
export const paymentMethodsAPI = {
  getAll: (params = {}) => 
    api.get('/payments/methods', { params }),
  create: (data) => 
    api.post('/payments/methods', data),
  update: (id, data) => 
    api.put(`/payments/methods/${id}`, data),
  delete: (id) => 
    api.delete(`/payments/methods/${id}`),
}

// =====================
// USERS API
// =====================
export const usersAPI = {
  getAll: () => 
    api.get('/users'),
  
  getRoles: () => 
    api.get('/users/roles'),
  
  getById: (id) => 
    api.get(`/users/${id}`),
  
  create: (data) => 
    api.post('/users', data),
  
  update: (id, data) => 
    api.put(`/users/${id}`, data),
  
  resetPin: (id, newPin) => 
    api.post(`/users/${id}/reset-pin`, { new_pin: newPin }),
  
  delete: (id) => 
    api.delete(`/users/${id}`),
}

export default api
