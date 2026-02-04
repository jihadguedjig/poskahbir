import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Lock, Save } from 'lucide-react'

export default function ProfilePage() {
  const { user, updateProfile, changePin } = useAuth()
  const [fullName, setFullName] = useState(user?.fullName || '')

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName)
  }, [user?.fullName])
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changingPin, setChangingPin] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || fullName.trim().length < 2) return
    setSavingProfile(true)
    try {
      await updateProfile(fullName.trim())
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePin = async (e) => {
    e.preventDefault()
    if (newPin.length < 4 || newPin.length > 8) {
      return
    }
    if (newPin !== confirmPin) {
      return
    }
    setChangingPin(true)
    try {
      const result = await changePin(currentPin, newPin)
      if (result.success) {
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
      }
    } finally {
      setChangingPin(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen p-4 lg:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold text-surface-800 mb-6">
        Profile
      </h1>

      {/* Profile info */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Username</p>
            <p className="font-semibold text-surface-800">{user.username}</p>
            <p className="text-sm text-surface-500 capitalize">{user.role}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input w-full"
              placeholder="Your full name"
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile || fullName.trim() === (user.fullName || '')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      {/* Change PIN */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Change PIN
        </h2>
        <p className="text-sm text-surface-500 mb-4">
          Enter your current PIN and choose a new 4–8 digit PIN.
        </p>
        <form onSubmit={handleChangePin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Current PIN</label>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="input w-full"
              placeholder="••••"
              minLength={4}
              maxLength={8}
              inputMode="numeric"
              pattern="\d{4,8}"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">New PIN</label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="input w-full"
              placeholder="••••"
              minLength={4}
              maxLength={8}
              inputMode="numeric"
              pattern="\d{4,8}"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Confirm new PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="input w-full"
              placeholder="••••"
              minLength={4}
              maxLength={8}
              inputMode="numeric"
              pattern="\d{4,8}"
              required
            />
            {confirmPin && newPin !== confirmPin && (
              <p className="text-sm text-red-600 mt-1">PINs do not match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={changingPin || newPin.length < 4 || newPin !== confirmPin}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {changingPin ? 'Changing…' : 'Change PIN'}
          </button>
        </form>
      </div>
    </div>
  )
}
