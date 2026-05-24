import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { incidentsAPI, usersAPI } from '../services/api'
import Toast from '../components/Toast'
import Pagination from '../components/Pagination'
import IncidentDetail from '../components/IncidentDetail'
import { cn } from '../lib/cn'
import { isAdmin as checkAdmin } from '../lib/roles'
import { useToast } from '../hooks/useToast'

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

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-red-100 text-red-700',
}

function SeverityBadge({ name, color }) {
  return (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: color }}>
      {name}
    </span>
  )
}

function StatusBadge({ name }) {
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[name] || 'bg-gray-100')}>{name}</span>
}

const Incidents = memo(function Incidents({ user, myIncidents }) {
  const isAdmin = checkAdmin(user)

  const [incidents, setIncidents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [tab, setTab] = useState('active')
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10)
  })
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', severity_id: 1, location: '', assigned_to: '' })
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const { toast, showToast, closeToast } = useToast()
  const limit = 20
  const abortRef = useRef(null)
  const exportRef = useRef(null)

  const adminTabs = [
    { key: 'active', label: 'Active' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'archived', label: 'Archived' },
  ]
  const operatorTabs = [
    { key: 'active', label: 'Active' },
    { key: 'archived', label: 'Archived' },
  ]
  const tabs = isAdmin && !myIncidents ? adminTabs : operatorTabs

  const statusGroupParam = tab

  const fetchIncidents = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    const params = { page, limit, status_group: statusGroupParam }
    if (myIncidents) {
      params.assigned_to_me = true
    }
    if (submittedSearch) params.search = submittedSearch
    if (sevFilter) params.severity = sevFilter
    incidentsAPI.list(params, { signal: controller.signal })
      .then(res => { setIncidents(res.data.data); setTotal(res.data.total) })
      .catch(err => { if (err.code !== 'ERR_CANCELED') showToast('Failed to load incidents', 'error') })
      .finally(() => setLoading(false))
  }, [page, sevFilter, statusGroupParam, tab, submittedSearch])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])
  useEffect(() => { if (refresh) fetchIncidents() }, [refresh])

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportOptions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadOperators = useCallback(() => {
    if (operators.length === 0 && isAdmin) {
      usersAPI.list({ role: 'operator' }).then(res => setOperators(res.data)).catch(() => {})
    }
  }, [operators.length, isAdmin])

  const handleSearch = (e) => {
    e.preventDefault()
    setSubmittedSearch(search)
    setPage(1)
  }

  const handleExport = () => {
    const params = { status_group: tab, date_from: exportDateFrom, date_to: exportDateTo }
    if (submittedSearch) params.search = submittedSearch
    if (sevFilter) params.severity = sevFilter
    setShowExportOptions(false)
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

  const setLastMonths = (n) => {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(); from.setMonth(from.getMonth() - n)
    setExportDateFrom(from.toISOString().slice(0, 10))
    setExportDateTo(to)
  }

  const switchTab = (key) => {
    setTab(key)
    setPage(1)
  }

  const resetForm = () => {
    setForm({ title: '', description: '', severity_id: 1, location: '', assigned_to: '' })
  }

  const openCreate = () => {
    resetForm()
    loadOperators()
    setShowCreate(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        severity_id: form.severity_id,
        location: form.location || null,
      }
      if (isAdmin && form.assigned_to) payload.assigned_to = form.assigned_to
      await incidentsAPI.create(payload)
      showToast('Incident created successfully')
      setShowCreate(false)
      fetchIncidents()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Create failed', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this incident?')) return
    try {
      await incidentsAPI.delete(id)
      showToast('Incident deleted successfully')
      fetchIncidents()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  const handleDetailUpdated = () => {
    setRefresh(n => n + 1)
  }

  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit])

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
        <div className="relative" ref={exportRef}>
          <button type="button" onClick={() => setShowExportOptions(!showExportOptions)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 whitespace-nowrap">Export CSV</button>
          {showExportOptions && (
            <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-lg p-4 z-50 w-72">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLastMonths(3)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50">3 Months</button>
                  <button type="button" onClick={() => setLastMonths(6)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50">6 Months</button>
                  <button type="button" onClick={() => setLastMonths(12)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50">1 Year</button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input type="date" value={exportDateFrom}
                    onChange={e => setExportDateFrom(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input type="date" value={exportDateTo}
                    onChange={e => setExportDateTo(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm outline-none" />
                </div>
                <button type="button" onClick={handleExport}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm font-medium">Download CSV</button>
              </div>
            </div>
          )}
        </div>
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
                <td className="p-3"><SeverityBadge name={inc.severity_name} color={inc.severity_color} /></td>
                <td className="p-3"><StatusBadge name={inc.status_name} /></td>
                <td className="p-3 text-sm">{inc.reported_by_name}</td>
                <td className="p-3 text-sm">{inc.assigned_to_name || '-'}</td>
                <td className="p-3 text-sm">{new Date(inc.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDetailId(inc.id)}
                      className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700">Detail</button>
                    {isAdmin && (
                      <button type="button" onClick={() => handleDelete(inc.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">New Incident</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" rows="3" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Severity</label>
                <select value={form.severity_id}
                  onChange={e => setForm({ ...form, severity_id: Number(e.target.value) })}
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
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned To</label>
                  <select value={form.assigned_to}
                    onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Unassigned --</option>
                    {operators.filter(op => op.is_active).map(op => (
                      <option key={op.id} value={op.id}>{op.full_name} ({op.username})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IncidentDetail
        incidentId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onUpdated={handleDetailUpdated}
        user={user}
        showToast={showToast}
      />
    </div>
  )
})

export default Incidents
