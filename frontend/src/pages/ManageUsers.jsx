import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { usersAPI } from '../services/api'
import { cn } from '../lib/cn'
import { isSuperadmin } from '../lib/roles'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

export default function ManageUsers({ user }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [manageUser, setManageUser] = useState(null)
  const [manageMode, setManageMode] = useState('view')
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'operator' })
  const [manageForm, setManageForm] = useState({ username: '', full_name: '', role: 'operator' })
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
    setForm({ username: '', password: '', full_name: '', role: 'operator' })
    setShowModal(true)
  }

  const openManage = (u) => {
    setManageUser(u)
    setManageMode('view')
    setManageForm({ username: u.username || '', full_name: u.full_name || '', role: u.role })
    setResetPw('')
  }

  const closeManage = () => {
    setManageUser(null)
    setManageMode('view')
    setResetPw('')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await usersAPI.create({ username: form.username, password: form.password, full_name: form.full_name, role: form.role })
      showToast('User created successfully')
      setShowModal(false)
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Create failed', 'error')
    }
  }

  const handleEditSave = async () => {
    if (!manageUser) return
    try {
      await usersAPI.update(manageUser.id, { username: manageForm.username, full_name: manageForm.full_name, role: manageForm.role })
      showToast('User updated successfully')
      setManageMode('view')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error')
    }
  }

  const handleResetPassword = async () => {
    if (!manageUser) return
    if (!resetPw || resetPw.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    try {
      await usersAPI.resetPassword(manageUser.id, { password: resetPw })
      showToast('Password reset successfully')
      setManageMode('view')
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
      if (manageUser?.id === u.id) setManageUser({ ...u, is_active: !u.is_active })
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
    try {
      const res = await usersAPI.delete(u.id)
      showToast(res.data.message)
      closeManage()
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  const roleBadge = (role) => {
    const colors = { superadmin: 'bg-emerald-100 text-emerald-700', admin: 'bg-purple-100 text-purple-700', operator: 'bg-blue-100 text-blue-700' }
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[role] || 'bg-gray-100')}>{role}</span>
  }

  const SORTABLE_COLS = [
    { key: 'username', label: 'Username', className: 'w-[18%]' },
    { key: 'full_name', label: 'Full Name', className: 'w-[22%]' },
    { key: 'role', label: 'Role', className: 'w-[10%]' },
    { key: 'is_active', label: 'Status', className: 'w-[10%]' },
    { key: 'created_at', label: 'Created', className: 'w-[15%]' },
  ]

  const handleSort = (colKey) => {
    if (sortBy === colKey) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy('')
        setSortOrder('')
      }
    } else {
      setSortBy(colKey)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ colKey }) => {
    if (sortBy !== colKey) return null
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 inline-block ml-0.5 -mt-0.5" />
      : <ChevronDown className="w-3.5 h-3.5 inline-block ml-0.5 -mt-0.5" />
  }

  const displayedUsers = useMemo(() => {
    let filtered = search
      ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase()))
      : users
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortBy]
        let bVal = b[sortBy]
        if (sortBy === 'username' || sortBy === 'full_name' || sortBy === 'role') {
          aVal = (aVal || '').toLowerCase()
          bVal = (bVal || '').toLowerCase()
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        if (sortBy === 'is_active') {
          return sortOrder === 'asc' ? (aVal ? 1 : -1) - (bVal ? 1 : -1) : (bVal ? 1 : -1) - (aVal ? 1 : -1)
        }
        if (sortBy === 'created_at') {
          return sortOrder === 'asc' ? new Date(aVal) - new Date(bVal) : new Date(bVal) - new Date(aVal)
        }
        return 0
      })
    }
    return filtered
  }, [users, search, sortBy, sortOrder])

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
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 select-none">
            <tr>
              {SORTABLE_COLS.map(col => (
                <th key={col.key}
                  className={cn('p-3 text-left cursor-pointer hover:text-gray-700 transition-colors', col.className)}
                  onClick={() => handleSort(col.key)}>
                  {col.label}
                  <SortIcon colKey={col.key} />
                </th>
              ))}
               <th className="p-3 text-left w-[10%]"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : displayedUsers.length === 0 ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">{search ? 'No users match your search' : 'No users found'}</td></tr>
            ) : displayedUsers.map(u => (
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
                  <td className="p-3 text-right">
                    <button onClick={() => openManage(u)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {manageUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeManage}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* ── HEADER ── */}
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-800">Manage User</h2>
              <button onClick={closeManage} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {/* ── USER INFO CARD ── */}
            <div className="p-5 border-b bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold shrink-0">
                  {(manageUser.full_name || manageUser.username).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{manageUser.full_name}</p>
                  <p className="text-sm text-gray-500">@{manageUser.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {roleBadge(manageUser.role)}
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', manageUser.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {manageUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Created {new Date(manageUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* ── VIEW MODE: ACTION LIST ── */}
            {manageMode === 'view' && (
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</p>

                <button onClick={() => {
                  setManageForm({ username: manageUser.username || '', full_name: manageUser.full_name || '', role: manageUser.role })
                  setManageMode('edit')
                }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-left">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-sm">&#9998;</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">Edit User</p>
                    <p className="text-xs text-gray-400">Change name or role</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                </button>

                <button onClick={() => { setResetPw(''); setManageMode('resetpw') }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-left">
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-sm">&#128273;</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">Reset Password</p>
                    <p className="text-xs text-gray-400">Set a new password for user</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                </button>

                <button onClick={() => handleToggleActive(manageUser)} disabled={isSuperadmin(manageUser)}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left',
                    isSuperadmin(manageUser) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50')}>
                  <span className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm',
                    manageUser.is_active ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600')}>
                    {manageUser.is_active ? <>&#9208;</> : <>&#9654;</>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{manageUser.is_active ? 'Deactivate User' : 'Activate User'}</p>
                    <p className="text-xs text-gray-400">{manageUser.is_active ? 'Prevent user from logging in' : 'Restore user access'}</p>
                  </div>
                </button>

                {!isSuperadmin(manageUser) && (
                  <button onClick={() => { if (window.confirm(`Delete ${manageUser.full_name} permanently?`)) handleDelete(manageUser) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-left">
                    <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-sm">&#128465;</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-red-700">Delete User</p>
                      <p className="text-xs text-red-400">Remove user permanently</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-red-300 -rotate-90" />
                  </button>
                )}
              </div>
            )}

            {/* ── EDIT MODE ── */}
            {manageMode === 'edit' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit User</p>
                  <button onClick={() => setManageMode('view')} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Username</label>
                  <input type="text" value={manageForm.username}
                    onChange={e => setManageForm({ ...manageForm, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                  <input type="text" value={manageForm.full_name}
                    onChange={e => setManageForm({ ...manageForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select value={manageForm.role}
                    onChange={e => setManageForm({ ...manageForm, role: e.target.value })}
                    disabled={manageUser.role === 'superadmin' && !canManageSuperadmin}
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500',
                      manageUser.role === 'superadmin' && !canManageSuperadmin && 'bg-gray-100 cursor-not-allowed')}>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                    {canManageSuperadmin && <option value="superadmin">Superadmin</option>}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setManageMode('view')}
                    className="px-4 py-2 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleEditSave}
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                </div>
              </div>
            )}

            {/* ── RESET PW MODE ── */}
            {manageMode === 'resetpw' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reset Password</p>
                  <button onClick={() => setManageMode('view')} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">New Password</label>
                  <input type="password" placeholder="Min 6 characters" value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setManageMode('view')}
                    className="px-4 py-2 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleResetPassword}
                    className="px-4 py-2 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700">Reset</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username *</label>
                <input type="text" value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <input type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
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
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  {canManageSuperadmin && <option value="superadmin">Superadmin</option>}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
