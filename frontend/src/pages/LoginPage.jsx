import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../services/api'
import { Flame, Delete, User } from 'lucide-react'

export default function LoginPage() {
  const [users, setUsers] = useState([])
  const [selectedUsername, setSelectedUsername] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState('user')
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    authAPI
      .getLoginOptions()
      .then((res) => setUsers(res.data.data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingOptions(false))
  }, [])

  const selectedUser = users.find((u) => u.username === selectedUsername)
  const fullName = selectedUser?.full_name || selectedUsername

  const handleUserSubmit = (e) => {
    e.preventDefault()
    if (selectedUsername.trim()) setStep('pin')
  }

  const handlePinDigit = useCallback((digit) => {
    setPin((prev) => {
      const s = String(prev ?? '')
      if (s.length >= 8) return s
      return s + digit
    })
  }, [])

  const handlePinBackspace = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setPin((prev) => String(prev ?? '').slice(0, -1))
  }, [])

  const handlePinClear = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setPin('')
  }, [])

  const handleLogin = useCallback(async () => {
    if (pin.length < 4) return
    setLoading(true)
    const result = await login(selectedUsername, pin)
    setLoading(false)
    if (result.success) {
      navigate('/')
    } else {
      setPin('')
    }
  }, [login, selectedUsername, pin, navigate])

  const handleBack = () => {
    setStep('user')
    setPin('')
  }

  const pinStr = String(pin ?? '')

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Flame className="w-12 h-12 text-primary-500" />
            <span className="text-4xl font-bold text-white">Showaya</span>
          </div>
          <p className="text-surface-400">Point of Sale System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 'user' ? (
            <form onSubmit={handleUserSubmit}>
              <h2 className="text-2xl font-bold text-surface-800 mb-6 text-center">
                Welcome Back
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-surface-600 mb-2">
                  Select your name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 pointer-events-none z-10" />
                  <select
                    value={selectedUsername}
                    onChange={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedUsername(e.target.value)
                    }}
                    className="input pl-12 w-full appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Choose your name</option>
                    {users.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.full_name || u.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedUsername.trim() || loadingOptions}
                className="btn btn-primary w-full btn-lg"
              >
                {loadingOptions ? 'Loading…' : 'Continue'}
              </button>
            </form>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-surface-500 hover:text-surface-700 font-medium"
                >
                  ← Back
                </button>
                <h2 className="text-lg font-semibold text-surface-800 truncate max-w-[180px]">
                  {fullName}
                </h2>
              </div>

              <p className="text-center text-surface-600 mb-4">
                Enter your PIN
              </p>

              {/* PIN Display (dots) */}
              <div className="flex justify-center gap-3 mb-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all ${
                      i < pinStr.length ? 'bg-primary-500 scale-110' : 'bg-surface-200'
                    }`}
                  />
                ))}
              </div>

              {/* Keypad - same style as Set price modal */}
              <div
                className="grid grid-cols-3 gap-2 mb-4"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePinDigit(key)
                    }}
                    className="h-12 rounded-xl text-lg font-semibold bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300 transition-colors cursor-pointer touch-manipulation select-none disabled:opacity-50"
                  >
                    {key}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePinClear}
                  className="h-12 rounded-xl text-base font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors cursor-pointer touch-manipulation select-none disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handlePinDigit('0')
                  }}
                  className="h-12 rounded-xl text-lg font-semibold bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300 transition-colors cursor-pointer touch-manipulation select-none disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePinBackspace}
                  className="h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors cursor-pointer touch-manipulation select-none disabled:opacity-50"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={pinStr.length < 4 || loading}
                className="btn btn-primary w-full btn-lg"
              >
                {loading ? (
                  <span className="spinner mx-auto" />
                ) : (
                  'Login'
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-surface-500 mt-6 text-sm">
          © 2024 Showaya Restaurant. All rights reserved.
        </p>
      </div>
    </div>
  )
}
