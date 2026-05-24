import { useState, useEffect, memo } from 'react'
import { PenLine } from 'lucide-react'
import { incidentsAPI, usersAPI } from '../services/api'
import { cn } from '../lib/cn'
import { timeAgo } from '../lib/time'

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-red-100 text-red-700',
}

const STATUS_OPTIONS = [
  { value: 1, label: 'OPEN' },
  { value: 2, label: 'IN_PROGRESS' },
  { value: 3, label: 'RESOLVED' },
  { value: 4, label: 'CLOSED' },
  { value: 5, label: 'ESCALATED' },
]

const OPERATOR_STATUS_OPTIONS = [
  { value: 1, label: 'OPEN' },
  { value: 2, label: 'IN_PROGRESS' },
  { value: 3, label: 'RESOLVED' },
]

function StatusBadge({ name }) {
  return <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium leading-none', STATUS_COLORS[name] || 'bg-gray-100')}>{name}</span>
}

const IncidentDetail = memo(function IncidentDetail({ incidentId, isOpen, onClose, onUpdated, user, showToast }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ status_id: 1, description: '', comment: '', assigned_to: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [operators, setOperators] = useState([])

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const isAssignedToMe = detail && detail.assigned_to != null &&
    String(detail.assigned_to).toLowerCase() === String(user?.user_id).toLowerCase()

  useEffect(() => {
    if (!incidentId || !isOpen) { setDetail(null); return }
    setLoading(true)
    incidentsAPI.get(incidentId)
      .then(res => setDetail(res.data))
      .catch(() => { setDetail(null); onClose() })
      .finally(() => setLoading(false))
  }, [incidentId, isOpen])

  const openEdit = () => {
    if (!detail) return
    setEditForm({ status_id: detail.status_id, description: detail.description || '', comment: '', assigned_to: detail.assigned_to || '' })
    setEditMode(true)
    if (isAdmin && operators.length === 0) {
      usersAPI.list({ role: 'operator' }).then(res => setOperators(res.data)).catch(() => {})
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    try {
      const payload = { status_id: editForm.status_id }
      if (isAdmin) {
        payload.description = editForm.description
        payload.assigned_to = editForm.assigned_to
      }
      if (editForm.comment) payload.comment = editForm.comment
      await incidentsAPI.update(incidentId, payload)
      showToast('Incident updated')
      setEditMode(false)
      const res = await incidentsAPI.get(incidentId)
      setDetail(res.data)
      if (onUpdated) onUpdated()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await incidentsAPI.deleteComment(incidentId, commentId)
      showToast('Comment deleted')
      const res = await incidentsAPI.get(incidentId)
      setDetail(res.data)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete comment', 'error')
    }
  }

  if (!isOpen) return null

  const severityBadge = (name, color) => (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold leading-none" style={{ backgroundColor: color }}>{name}</span>
  )

  const OPERATOR_TRANSITIONS = { 1: [1, 2], 2: [2, 3], 3: [], 4: [], 5: [] }

  const statusOpts = isAdmin
    ? STATUS_OPTIONS
    : (OPERATOR_TRANSITIONS[detail?.status_id] || []).map(id =>
        STATUS_OPTIONS.find(s => s.value === id)
      ).filter(Boolean)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading detail...</div>
        ) : detail ? (
          <>
            <div className="p-6 border-b flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {severityBadge(detail.severity_name, detail.severity_color)}
                  <StatusBadge name={detail.status_name} />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{detail.title}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!editMode && (isAdmin || (isAssignedToMe && OPERATOR_TRANSITIONS[detail?.status_id]?.length > 0)) && (
                  <button onClick={openEdit}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    <PenLine className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                <button onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>

            <div className="p-6 space-y-4">

              {!editMode && detail.description && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</h3>
                  <p className="text-sm">{detail.location || '-'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">SLA Hours</h3>
                  <p className="text-sm">{detail.sla_hours}h</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Reported By</h3>
                  <p className="text-sm">{detail.reported_by_name}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Assigned To</h3>
                  <p className="text-sm">{detail.assigned_to_name || '-'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Created</h3>
                  <p className="text-sm">{timeAgo(detail.created_at)}</p>
                </div>
                {detail.resolved_at && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Resolved</h3>
                    <p className="text-sm">{timeAgo(detail.resolved_at)}</p>
                  </div>
                )}
              </div>

              {editMode && (
                <form onSubmit={handleEditSubmit} className="border-t pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">Edit Incident</h3>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        rows="3" />
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                      <select value={editForm.assigned_to}
                        onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Unassigned --</option>
                        {operators.filter(op => op.is_active).map(op => (
                          <option key={op.id} value={op.id}>{op.full_name} ({op.username})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select value={editForm.status_id}
                      onChange={e => setEditForm({ ...editForm, status_id: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      {statusOpts.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Comment</label>
                    <textarea value={editForm.comment}
                      onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      rows="2" placeholder={isAdmin ? 'Add a note...' : 'Describe what was done...'} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditMode(false)}
                      className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={editSaving}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {detail.comments && detail.comments.length > 0 && (
                <div className={editMode ? '' : 'border-t pt-4'}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Comments ({detail.comments.length})</h3>
                  <div className="space-y-2">
                    {detail.comments.map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{c.username}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                            {isAdmin && (
                              <button onClick={() => handleDeleteComment(c.id)}
                                className="text-red-400 hover:text-red-600 text-sm leading-none">&times;</button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-red-500">Failed to load incident detail</div>
        )}
      </div>
    </div>
  )
})

export default IncidentDetail
