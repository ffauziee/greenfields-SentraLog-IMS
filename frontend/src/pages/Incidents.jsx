import { useState, useEffect, useCallback } from 'react'
import { incidentsAPI } from '../services/api'
import Toast from '../components/Toast'

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', severity_id: 1, location: '' })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const limit = 20

  const showToast = (message, type = 'success') => setToast({ message, type })
  const closeToast = () => setToast(null)

  const fetchIncidents = useCallback(() => {
    setLoading(true)
    const params = { page, limit }
    if (search) params.search = search
    if (sevFilter) params.severity = sevFilter
    incidentsAPI.list(params)
      .then(res => { setIncidents(res.data.data); setTotal(res.data.total) })
      .catch(() => showToast('Failed to load incidents', 'error'))
      .finally(() => setLoading(false))
  }, [page, search, sevFilter])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
  }

  const openCreate = () => {
    setEditId(null)
    setForm({ title: '', description: '', severity_id: 1, location: '' })
    setShowModal(true)
  }

  const openEdit = (inc) => {
    setEditId(inc.id)
    setForm({ title: inc.title, description: inc.description || '', severity_id: inc.severity_id, location: inc.location || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        await incidentsAPI.update(editId, form)
        showToast('Incident updated successfully')
      } else {
        await incidentsAPI.create(form)
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

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Incidents</h1>
        <button onClick={openCreate}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          + New Incident
        </button>
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
      </form>

      <div className="bg-white rounded-xl shadow overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left w-[30%]">Title</th>
              <th className="p-3 text-left w-[12%]">Severity</th>
              <th className="p-3 text-left w-[12%]">Status</th>
              <th className="p-3 text-left w-[14%]">Reported By</th>
              <th className="p-3 text-left w-[14%]">Assigned To</th>
              <th className="p-3 text-left w-[10%]">Created</th>
              <th className="p-3 text-left w-[8%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : incidents.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-500">No incidents found</td></tr>
            ) : incidents.map(inc => (
              <tr key={inc.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{inc.title}</td>
                <td className="p-3">{severityBadge(inc.severity_name, inc.severity_color)}</td>
                <td className="p-3">{inc.status_name}</td>
                <td className="p-3 text-sm">{inc.reported_by_name}</td>
                <td className="p-3 text-sm">{inc.assigned_to_name || '-'}</td>
                <td className="p-3 text-sm">{new Date(inc.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(inc)}
                            className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => handleDelete(inc.id)}
                            className="text-red-600 hover:underline text-sm">Delete</button>
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
