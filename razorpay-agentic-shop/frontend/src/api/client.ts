import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('agentic_shop_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Optional response interceptor for unified error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      (error.response?.status === 401 ? 'Please login to continue' : null) ||
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    console.error('API Error:', message)
    return Promise.reject(new Error(message))
  }
)

export default apiClient
