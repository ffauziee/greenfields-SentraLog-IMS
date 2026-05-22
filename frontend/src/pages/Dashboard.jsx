import { useState, useEffect, memo } from 'react'
import { incidentsAPI } from '../services/api'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'

const Dashboard = memo(function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    incidentsAPI.dashboard()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!detailId) { setDetail(null); return }
    setDetailLoading(true)
    incidentsAPI.get(detailId)
      .then(res => setDetail(res.data))
      .catch(() => { setDetail(null); setDetailId(null) })
      .finally(() => setDetailLoading(false))
  }, [detailId])

  if (loading) return <div className="p-6 text-gray-500">Loading dashboard...</div>

  const severityBadge = (name, color) => (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: color }}>
      {name}
    </span>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Open Incidents</p>
          <p className="text-3xl font-bold text-gray-800">{data?.total_open || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Critical Incidents</p>
          <p className="text-3xl font-bold text-red-600">{data?.critical_count || 0}</p>
        </div>
        <Link to="/incidents?tab=unassigned" className="bg-white rounded-xl shadow p-6 border-l-4 border-yellow-500 block hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Unassigned Incidents</p>
          <p className="text-3xl font-bold text-yellow-600">{data?.unassigned_count || 0}</p>
        </Link>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-orange-500">
          <p className="text-sm text-gray-500">Past SLA</p>
          <p className="text-3xl font-bold text-orange-600">{data?.past_sla_count || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow mb-8">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Attention Prioritized Incidents</h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline">View All</Link>
        </div>
        <div className="overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left w-[10%]">Attention</th>
                <th className="p-3 text-left w-[24%]">Title</th>
                <th className="p-3 text-left w-[11%]">Severity</th>
                <th className="p-3 text-left w-[11%]">Status</th>
                <th className="p-3 text-left w-[11%]">Reported By</th>
                <th className="p-3 text-left w-[13%]">Assigned To</th>
                <th className="p-3 text-left w-[10%]">Age</th>
                <th className="p-3 text-left w-[10%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.attention_incidents?.map(inc => {
                const isOverdue = inc.age_hours > inc.sla_hours
                return (
                  <tr key={inc.id}
                    className={cn('border-t hover:bg-gray-50', inc.severity_name === 'CRITICAL' && 'bg-red-50')}>
                    <td className="p-3">
                      <div className="w-8 bg-gray-200 rounded-full text-xs text-center font-bold"
                        style={{ color: inc.attention_score >= 70 ? '#ef4444' : inc.attention_score >= 40 ? '#f97316' : '#22c55e' }}>
                        {inc.attention_score}
                      </div>
                    </td>
                    <td className="p-3 font-medium">
                      <span>{inc.title}</span>
                      {isOverdue && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">SLA breached</span>}
                    </td>
                    <td className="p-3">{severityBadge(inc.severity_name, inc.severity_color)}</td>
                    <td className="p-3">{inc.status_name}</td>
                    <td className="p-3 text-sm">{inc.reported_by_name}</td>
                    <td className="p-3 text-sm">{inc.assigned_to_name || '-'}</td>
                    <td className="p-3 text-sm">{Math.round(inc.age_hours)}h</td>
                    <td className="p-3">
                      <button onClick={() => setDetailId(inc.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Detail</button>
                    </td>
                  </tr>
                )
              })}
              {(!data?.attention_incidents || data.attention_incidents.length === 0) && (
                <tr><td colSpan="8" className="p-6 text-center text-gray-500">No incidents found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Recent Incidents</h2>
        </div>
        <div className="divide-y">
          {data?.recent?.map(inc => (
            <div key={inc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {severityBadge(inc.severity_name, inc.severity_color)}
                  <span className="font-medium">{inc.title}</span>
                </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{new Date(inc.created_at).toLocaleDateString()}</span>
                <button onClick={() => setDetailId(inc.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Detail</button>
              </div>
            </div>
          ))}
          {(!data?.recent || data.recent.length === 0) && (
            <p className="p-4 text-center text-gray-500">No recent incidents</p>
          )}
        </div>
      </div>

      {detailId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-8 text-center text-gray-500">Loading detail...</div>
            ) : detail ? (
              <>
                <div className="p-6 border-b flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {severityBadge(detail.severity_name, detail.severity_color)}
                      <span className="text-xs text-gray-400">{detail.status_name}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">{detail.title}</h2>
                  </div>
                  <button onClick={() => setDetailId(null)}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>

                <div className="p-6 space-y-4">
                  {detail.description && (
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
                      <p className="text-sm">{new Date(detail.created_at).toLocaleString()}</p>
                    </div>
                    {detail.resolved_at && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Resolved</h3>
                        <p className="text-sm">{new Date(detail.resolved_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {detail.comments && detail.comments.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Comments ({detail.comments.length})</h3>
                      <div className="space-y-2">
                        {detail.comments.map(c => (
                          <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{c.username}</span>
                              <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
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
      )}
    </div>
  )
})

export default Dashboard
