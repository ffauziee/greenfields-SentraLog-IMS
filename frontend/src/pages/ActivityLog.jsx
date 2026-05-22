import { useState, useEffect, useCallback, useMemo, memo, Fragment } from 'react'
import { auditAPI } from '../services/api'
import { cn } from '../lib/cn'
import Toast from '../components/Toast'

let cachedUsers = null

const ActivityLog = memo(function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState(cachedUsers || [])
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [expandId, setExpandId] = useState(null)
  const [toast, setToast] = useState(null)
  const limit = 20

  const showToast = (message, type = 'error') => setToast({ message, type })
  const closeToast = () => setToast(null)

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const params = { page, limit }
    if (filterUser) params.user_id = filterUser
    if (filterAction) params.action = filterAction
    auditAPI.list(params)
      .then(res => { setLogs(res.data.data); setTotal(res.data.total) })
      .catch(() => showToast('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [page, filterUser, filterAction])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!cachedUsers) {
      auditAPI.users()
        .then(res => { cachedUsers = res.data; setUsers(res.data) })
        .catch(() => { })
    }
  }, [])

  const actionBadge = (action) => {
    const colors = { CREATE: 'bg-green-100 text-green-700', UPDATE: 'bg-blue-100 text-blue-700', DELETE: 'bg-red-100 text-red-700' }
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[action] || 'bg-gray-100')}>{action}</span>
  }

  const renderValue = (val) => {
    if (!val) return <span className="text-gray-400 italic">null</span>
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val
      return <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
    } catch {
      return <span className="text-sm">{String(val)}</span>
    }
  }

  const totalPages = useMemo(() => Math.ceil(total / limit), [total])

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Activity Log</h1>

      <div className="flex gap-3 mb-6">
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          className="px-4 py-2 border rounded-lg outline-none">
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>
          ))}
        </select>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="px-4 py-2 border rounded-lg outline-none">
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <span className="text-sm text-gray-500 self-center ml-auto">{total} total entries</span>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left w-[16%]">Time</th>
              <th className="p-3 text-left w-[14%]">User</th>
              <th className="p-3 text-left w-[10%]">Action</th>
              <th className="p-3 text-left w-[12%]">Entity</th>
              <th className="p-3 text-left w-[20%]">Entity ID</th>
              <th className="p-3 text-left w-[28%]">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">No audit logs found</td></tr>
            ) : logs.map(log => (
              <Fragment key={log.id}>
                <tr className={cn('border-t hover:bg-gray-50 cursor-pointer')} onClick={() => setExpandId(expandId === log.id ? null : log.id)}>
                  <td className="p-3 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-3 text-sm">{log.username}</td>
                  <td className="p-3">{actionBadge(log.action)}</td>
                  <td className="p-3 text-sm">{log.entity_type}</td>
                  <td className="p-3 text-xs text-gray-500 truncate font-mono">{log.entity_id}</td>
                  <td className="p-3 text-sm text-blue-600">{expandId === log.id ? '▲ Hide' : '▼ View'}</td>
                </tr>
                {expandId === log.id && (
                  <tr key={`${log.id}-detail`} className="bg-gray-50">
                    <td colSpan="6" className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Old Value</h4>
                          {renderValue(log.old_value)}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">New Value</h4>
                          {renderValue(log.new_value)}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className={cn('px-3 py-1 border rounded', page <= 1 && 'disabled:opacity-50')}>Prev</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className={cn('px-3 py-1 border rounded', page >= totalPages && 'disabled:opacity-50')}>Next</button>
        </div>
      )}
    </div>
  )
})

export default ActivityLog
