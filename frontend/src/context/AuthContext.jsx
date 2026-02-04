import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')
      
      if (token && savedUser) {
        try {
          // Verify token is still valid
          const response = await authAPI.verify()
          setUser(response.data.data.user)
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      }
      
      setLoading(false)
    }
    
    initAuth()
  }, [])

  // Login function
  const login = useCallback(async (username, pin) => {
    try {
      const response = await authAPI.login(username, pin)
      const { token, user: userData } = response.data.data
      
      // Save to localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      
      setUser(userData)
      toast.success(`Welcome, ${userData.fullName}!`)
      
      return { success: true }
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        (error.message === 'Network Error' ? 'Connection error. Check your network.' : null) ||
        'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      toast.success('Logged out successfully')
    }
  }, [])

  // Update profile (full name)
  const updateProfile = useCallback(async (fullName) => {
    try {
      const response = await authAPI.updateProfile(fullName)
      const userData = response.data.data.user
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      toast.success('Profile updated')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to update profile'
      toast.error(message)
      return { success: false, error: message }
    }
  }, [])

  // Change PIN function
  const changePin = useCallback(async (currentPin, newPin) => {
    try {
      await authAPI.changePin(currentPin, newPin)
      toast.success('PIN changed successfully')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to change PIN'
      return { success: false, error: message }
    }
  }, [])

  // Check if user has permission
  const hasPermission = useCallback((resource, action) => {
    if (!user?.permissions) return false
    return user.permissions[resource]?.includes(action) ?? false
  }, [user])

  // Check if user has role
  const hasRole = useCallback((...roles) => {
    if (!user?.role) return false
    return roles.includes(user.role)
  }, [user])

  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    changePin,
    hasPermission,
    hasRole,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
