import { useState, useEffect, useCallback } from 'react'
import { usersAPI } from '../services/api'
import { cn } from '../lib/cn'
import { isAdmin, isSuperadmin } from '../lib/roles'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

export default function ManageUsers({ user }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [showResetPw, setShowResetPw] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'operator' })
  const [resetPw, setResetPw] = useState('')
  const { toast, showToast, closeToast } = useToast()

  const fetchUsers = useCallback(() => {
    setLoading(true)
    usersAPI.list()
      .then(res => setUsers(res.data))
      .catch(() => showToast('Failed to load users', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openCreate = () => {
    setEditId(null)
    setForm({ username: '', password: '', full_name: '', role: 'operator' })
    setShowModal(true)
  }

  const openEdit = (u) => {
    setEditId(u.id)
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        await usersAPI.update(editId, { full_name: form.full_name, role: form.role })
        showToast('User updated successfully')
      } else {
        await usersAPI.create({ username: form.username, password: form.password, full_name: form.full_name, role: form.role })
        showToast('User created successfully')
      }
      setShowModal(false)
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Operation failed', 'error')
    }
  }

  const handleResetPassword = async (id) => {
    if (!resetPw || resetPw.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    try {
      await usersAPI.resetPassword(id, { password: resetPw })
      showToast('Password reset successfully')
      setShowResetPw(null)
      setResetPw('')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Reset failed', 'error')
    }
  }

  const canManageSuperadmin = isSuperadmin(user)

  const handleToggleActive = async (u) => {
    if (isSuperadmin(u)) {
      showToast('Protected superadmin cannot be deactivated', 'error')
      return
    }
    try {
      await usersAPI.update(u.id, { is_active: !u.is_active })
      showToast(u.is_active ? 'User deactivated' : 'User activated')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed', 'error')
    }
  }

  const handleDelete = async (u) => {
    if (isSuperadmin(u)) {
      showToast('Protected superadmin cannot be deleted', 'error')
      return
    }
    if (!window.confirm(`Delete ${u.full_name}?`)) return
    try {
      const res = await usersAPI.delete(u.id)
      showToast(res.data.message)
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  const isEditingSuperadmin = editId && form.username === 'admin' && form.role === 'superadmin'

  const roleBadge = (role) => {
    const colors = { superadmin: 'bg-emerald-100 text-emerald-700', admin: 'bg-purple-100 text-purple-700', operator: 'bg-blue-100 text-blue-700' }
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[role] || 'bg-gray-100')}>{role}</span>
  }

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Manage Users</h1>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          + New User
        </button>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search by name or username..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left w-[18%]">Username</th>
              <th className="p-3 text-left w-[22%]">Full Name</th>
              <th className="p-3 text-left w-[10%]">Role</th>
              <th className="p-3 text-left w-[10%]">Status</th>
              <th className="p-3 text-left w-[15%]">Created</th>
              <th className="p-3 text-left w-[25%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : (() => {
              const filtered = search
                ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.full_name.toLowerCase().includes(search.toLowerCase()))
                : users
              return filtered.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">{search ? 'No users match your search' : 'No users found'}</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className={cn('border-t hover:bg-gray-50', !u.is_active && 'opacity-50')}>
                  <td className="p-3 font-medium">
                    {u.username}
                    {isSuperadmin(u) && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Superadmin</span>}
                  </td>
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3">{roleBadge(u.role)}</td>
                  <td className="p-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => openEdit(u)}
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700">Edit</button>
                      <button onClick={() => { setShowResetPw(u.id); setResetPw('') }}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700">Reset PW</button>
                      <button onClick={() => handleToggleActive(u)} disabled={isSuperadmin(u)}
                        className={cn('px-3 py-1 rounded text-xs text-white', isSuperadmin(u) ? 'bg-gray-300 cursor-not-allowed' : u.is_active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700')}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={isSuperadmin(u)}
                        className={cn('px-3 py-1 rounded text-xs text-white', isSuperadmin(u) ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700')}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            })()}
          </tbody>
        </table>
      </div>

      {showResetPw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Reset Password</h3>
            <input type="password" placeholder="New password (min 6 characters)" value={resetPw}
              onChange={e => setResetPw(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowResetPw(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleResetPassword(showResetPw)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Reset</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Edit User' : 'New User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username *</label>
                <input type="text" value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editId} disabled={!!editId} />
              </div>
              {!editId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password *</label>
                  <input type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  disabled={isEditingSuperadmin}
                  className={cn('w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500', isEditingSuperadmin && 'bg-gray-100 cursor-not-allowed')}>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  {(canManageSuperadmin || isEditingSuperadmin) && <option value="superadmin">Superadmin</option>}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
