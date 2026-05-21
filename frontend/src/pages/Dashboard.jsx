import { useState, useEffect } from 'react'
import { incidentsAPI } from '../services/api'
import { Link } from 'react-router-dom'
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    incidentsAPI.dashboard()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="p-6 text-gray-500">Loading dashboard...</div>
  const severityBadge = (name, color) => (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: color }}>
      {name}
    </span>
  )
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Open Incidents</p>
          <p className="text-3xl font-bold text-gray-800">{data?.total_open || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Critical Incidents</p>
          <p className="text-3xl font-bold text-red-600">{data?.critical_count || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border-l-4 border-orange-500">
          <p className="text-sm text-gray-500">Past SLA</p>
          <p className="text-3xl font-bold text-orange-600">{data?.past_sla?.length || 0}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow mb-8">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">⚠️ Attention-Prioritized Incidents</h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">Attention</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Severity</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Reported By</th>
                <th className="p-3 text-left">Age</th>
              </tr>
            </thead>
            <tbody>
              {data?.attention_incidents?.map(inc => {
                const isOverdue = inc.age_hours > inc.sla_hours
                return (
                  <tr key={inc.id}
                      className={`border-t hover:bg-gray-50 ${inc.severity_name === 'CRITICAL' ? 'bg-red-50' : ''}`}>
                    <td className="p-3">
                      <div className="w-8 bg-gray-200 rounded-full text-xs text-center font-bold"
                           style={{ color: inc.attention_score >= 70 ? '#ef4444' : inc.attention_score >= 40 ? '#f97316' : '#22c55e' }}>
                        {inc.attention_score}
                      </div>
                    </td>
                    <td className="p-3 font-medium">
                      <Link to={`/incidents/${inc.id}`} className="text-blue-600 hover:underline">
                        {inc.title}
                      </Link>
                      {isOverdue && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">SLA breached</span>}
                    </td>
                    <td className="p-3">{severityBadge(inc.severity_name, inc.severity_color)}</td>
                    <td className="p-3">{inc.status_name}</td>
                    <td className="p-3 text-sm">{inc.reported_by_name}</td>
                    <td className="p-3 text-sm">{Math.round(inc.age_hours)}h</td>
                  </tr>
                )
              })}
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
              <span className="text-sm text-gray-500">{new Date(inc.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}