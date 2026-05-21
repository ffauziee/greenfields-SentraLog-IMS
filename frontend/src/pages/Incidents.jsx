import { useState, useEffect, useCallback } from 'react'
import { incidentsAPI, usersAPI } from '../services/api'
import Toast from '../components/Toast'
import { cn } from '../lib/cn'

const STATUS_OPTIONS = {
  admin: [
    { value: 1, label: 'OPEN' },
    { value: 2, label: 'IN_PROGRESS' },
    { value: 3, label: 'RESOLVED' },
    { value: 4, label: 'CLOSED' },
    { value: 5, label: 'ESCALATED' },
  ],
  operator: [
    { value: 1, label: 'OPEN' },
    { value: 2, label: 'IN_PROGRESS' },
    { value: 3, label: 'RESOLVED' },
  ],
}

export default function Incidents({ user }) {
  const isAdmin = user?.role === 'admin'

  const [incidents, setIncidents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [tab, setTab] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', severity_id: 1, location: '', assigned_to: '', assigned_to_name: '', status_id: 1 })
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const limit = 20

  const adminTabs = [
    { key: 'active', label: 'Active' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'archived', label: 'Archived' },
  ]
  const operatorTabs = [
    { key: 'active', label: 'My Incidents' },
    { key: 'archived', label: 'Archived' },
  ]
  const tabs = isAdmin ? adminTabs : operatorTabs

  const showToast = (message, type = 'success') => setToast({ message, type })
  const closeToast = () => setToast(null)

  const statusGroupParam = tab

  const fetchIncidents = useCallback(() => {
    setLoading(true)
    const params = { page, limit, status_group: statusGroupParam }
    if (search) params.search = search
    if (sevFilter) params.severity = sevFilter
    incidentsAPI.list(params)
      .then(res => { setIncidents(res.data.data); setTotal(res.data.total) })
      .catch(() => showToast('Failed to load incidents', 'error'))
      .finally(() => setLoading(false))
  }, [page, search, sevFilter, statusGroupParam])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  useEffect(() => {
    if (isAdmin) {
      usersAPI.list({ role: 'operator' })
        .then(res => setOperators(res.data))
        .catch(() => {})
    }
  }, [isAdmin])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
  }

  const handleExport = () => {
    const params = { status_group: tab }
    if (search) params.search = search
    if (sevFilter) params.severity = sevFilter
    incidentsAPI.exportCSV(params)
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = `incidents_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => showToast('Export failed', 'error'))
  }

  const switchTab = (key) => {
    setTab(key)
    setPage(1)
  }

  const resetForm = () => {
    setForm({ title: '', description: '', severity_id: 1, location: '', assigned_to: '', assigned_to_name: '', status_id: 1 })
  }

  const openCreate = () => {
    setEditId(null)
    resetForm()
    setShowModal(true)
  }

  const openEdit = (inc) => {
    setEditId(inc.id)
    setForm({
      title: inc.title,
      description: inc.description || '',
      severity_id: inc.severity_id,
      location: inc.location || '',
      assigned_to: inc.assigned_to || '',
      assigned_to_name: inc.assigned_to_name || '',
      status_id: inc.status_id,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        severity_id: form.severity_id,
        location: form.location || null,
      }
      if (isAdmin) {
        if (form.assigned_to) payload.assigned_to = form.assigned_to
        if (editId) payload.status_id = form.status_id
      } else {
        if (editId) payload.status_id = form.status_id
      }

      if (editId) {
        await incidentsAPI.update(editId, payload)
        showToast('Incident updated successfully')
      } else {
        await incidentsAPI.create(payload)
        showToast('Incident created successfully')
      }
      setShowModal(false)
      fetchIncidents()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Operation failed', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await incidentsAPI.delete(id)
      showToast('Incident deleted successfully')
      fetchIncidents()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  const severityBadge = (name, color) => (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: color }}>
      {name}
    </span>
  )

  const statusBadge = (name) => {
    const colors = { OPEN: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-700', ESCALATED: 'bg-red-100 text-red-700' }
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[name] || 'bg-gray-100')}>{name}</span>
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Incidents</h1>
        <button onClick={openCreate}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          + New Incident
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input type="text" placeholder="Search incidents..." value={search}
               onChange={e => setSearch(e.target.value)}
               className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        <select value={sevFilter} onChange={e => { setSevFilter(e.target.value); setPage(1) }}
                className="px-4 py-2 border rounded-lg outline-none">
          <option value="">All Severities</option>
          <option value="4">CRITICAL</option>
          <option value="3">HIGH</option>
          <option value="2">MEDIUM</option>
          <option value="1">LOW</option>
        </select>
        <button type="submit" className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Search</button>
        <button type="button" onClick={handleExport}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 whitespace-nowrap">Export CSV</button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left w-[26%]">Title</th>
              <th className="p-3 text-left w-[11%]">Severity</th>
              <th className="p-3 text-left w-[13%]">Status</th>
              <th className="p-3 text-left w-[13%]">Reported By</th>
              <th className="p-3 text-left w-[13%]">Assigned To</th>
              <th className="p-3 text-left w-[10%]">Created</th>
              <th className="p-3 text-left w-[14%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : incidents.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-500">No incidents found</td></tr>
            ) : incidents.map(inc => (
              <tr key={inc.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium truncate">{inc.title}</td>
                <td className="p-3">{severityBadge(inc.severity_name, inc.severity_color)}</td>
                <td className="p-3">{statusBadge(inc.status_name)}</td>
                <td className="p-3 text-sm">{inc.reported_by_name}</td>
                <td className="p-3 text-sm">{inc.assigned_to_name || '-'}</td>
                <td className="p-3 text-sm">{new Date(inc.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(inc)}
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700">Edit</button>
                    <button onClick={() => handleDelete(inc.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Edit Incident' : 'New Incident'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input type="text" value={form.title}
                       onChange={e => setForm({...form, title: e.target.value})}
                       className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={form.description}
                          onChange={e => setForm({...form, description: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" rows="3" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Severity</label>
                <select value={form.severity_id}
                        onChange={e => setForm({...form, severity_id: Number(e.target.value)})}
                        className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="1">LOW</option>
                  <option value="2">MEDIUM</option>
                  <option value="3">HIGH</option>
                  <option value="4">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input type="text" value={form.location}
                       onChange={e => setForm({...form, location: e.target.value})}
                       className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {isAdmin ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned To</label>
                  <select value={form.assigned_to}
                          onChange={e => setForm({...form, assigned_to: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Unassigned --</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.full_name} ({op.username})</option>
                    ))}
                  </select>
                </div>

              ) : editId && form.assigned_to ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned To</label>
                  <p className="text-sm text-gray-700 px-4 py-2 bg-gray-50 rounded-lg border">
                    {form.assigned_to_name || form.assigned_to}
                  </p>
                </div>
              ) : null}

              {editId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={form.status_id}
                          onChange={e => setForm({...form, status_id: Number(e.target.value)})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    {(isAdmin ? STATUS_OPTIONS.admin : STATUS_OPTIONS.operator).map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {!isAdmin && (
                    <p className="text-xs text-gray-400 mt-1">Operator: OPEN → IN_PROGRESS → RESOLVED</p>
                  )}
                </div>
              )}

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
