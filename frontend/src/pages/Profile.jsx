import { useState } from 'react'
import { authAPI } from '../services/api'
import { cn } from '../lib/cn'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

export default function Profile({ user, onUserUpdate }) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  const handleSave = async (e) => {
    e.preventDefault()
    const body = {}
    if (fullName.trim() !== (user.full_name || '')) body.full_name = fullName.trim()

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error')
        return
      }
      if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error')
        return
      }
      if (!oldPassword) {
        showToast('Current password is required', 'error')
        return
      }
      body.old_password = oldPassword
      body.new_password = newPassword
    }

    if (Object.keys(body).length === 0) {
      showToast('No changes to save', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await authAPI.updateProfile(body)
      const updated = { ...user, ...res.data }
      localStorage.setItem('user', JSON.stringify(updated))
      if (onUserUpdate) onUserUpdate(updated)
      showToast('Profile updated')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Profile</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold shrink-0">
            {(user.full_name || user.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-lg">{user.full_name}</p>
            <p className="text-sm text-gray-500">@{user.username}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 capitalize">{user.role}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3">Edit Profile</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <hr className="border-gray-200" />

        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Change Password</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input type="password" value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input type="password" placeholder="Min 6 characters" value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving}
            className={cn('px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50')}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
