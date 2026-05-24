import { useState, useEffect, useMemo, memo } from 'react'
import { Activity, Flame, UserX, Clock } from 'lucide-react'
import { incidentsAPI } from '../services/api'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { timeAgo } from '../lib/time'
import Toast from '../components/Toast'
import IncidentDetail from '../components/IncidentDetail'
import { useToast } from '../hooks/useToast'

const STAT_CARDS = [
  { key: 'total_open', label: 'Total Open', icon: Activity, border: 'border-blue-500', textColor: 'text-gray-800', iconColor: 'text-blue-500' },
  { key: 'critical_count', label: 'Critical', icon: Flame, border: 'border-red-500', textColor: 'text-red-600', iconColor: 'text-red-500' },
  { key: 'unassigned_count', label: 'Unassigned', icon: UserX, border: 'border-yellow-500', textColor: 'text-yellow-600', iconColor: 'text-yellow-500', link: '/incidents?tab=unassigned' },
  { key: 'past_sla_count', label: 'Past SLA', icon: Clock, border: 'border-orange-500', textColor: 'text-orange-600', iconColor: 'text-orange-500' },
]

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const ATTENTION_COLOR = (score) =>
  score >= 70 ? 'text-red-500' : score >= 40 ? 'text-orange-500' : 'text-green-500'

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-red-100 text-red-700',
}

function StatusBadge({ name }) {
  return <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium leading-none', STATUS_COLORS[name] || 'bg-gray-100')}>{name}</span>
}

const Dashboard = memo(function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  useEffect(() => {
    setError(false)
    incidentsAPI.dashboard()
      .then(res => setData(res.data))
      .catch(() => { setError(true); showToast('Failed to load dashboard', 'error') })
      .finally(() => setLoading(false))
  }, [refresh])

  const handleDetailUpdated = () => setRefresh(n => n + 1)

  const groupedAttention = useMemo(() => {
    if (!data?.attention_incidents) return []
    const groups = {}
    for (const inc of data.attention_incidents) {
      const key = inc.severity_name
      if (!groups[key]) groups[key] = { name: key, color: inc.severity_color, incidents: [] }
      groups[key].incidents.push(inc)
    }
    return Object.values(groups).sort((a, b) => (SEVERITY_ORDER[a.name] ?? 99) - (SEVERITY_ORDER[b.name] ?? 99))
  }, [data?.attention_incidents])

  if (loading) return <div className="p-6 text-gray-500">Loading dashboard...</div>
  if (error) return <div className="p-6 text-red-500">Failed to load dashboard. <button onClick={() => setRefresh(n => n + 1)} className="underline hover:text-red-700">Retry</button></div>

  const severityBadge = (name, color) => (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold leading-none" style={{ backgroundColor: color }}>{name}</span>
  )

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {STAT_CARDS.map(card => {
          const Icon = card.icon
          const count = data?.[card.key] ?? 0
          const inner = (
            <div className={cn('bg-white rounded-xl shadow-sm p-4 border-l-4 transition-shadow', card.border, card.link && 'hover:shadow-md cursor-pointer')}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-4 h-4', card.iconColor)} />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</span>
              </div>
              <p className={cn('text-3xl font-bold', card.textColor)}>{count}</p>
            </div>
          )
          return card.link ? <Link key={card.key} to={card.link}>{inner}</Link> : <div key={card.key}>{inner}</div>
        })}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Attention Prioritized</h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline">View All &rarr;</Link>
        </div>

        {groupedAttention.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">No active incidents</div>
        ) : (
          <div className="space-y-4">
            {groupedAttention.map(group => (
              <div key={group.name} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className={cn('px-4 py-2 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2')}
                  style={{ backgroundColor: group.color }}>
                  <span className="w-2 h-2 rounded-full bg-white/80" />
                  {group.name}
                  <span className="ml-auto opacity-80">{group.incidents.length} incident{group.incidents.length > 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y">
                  {group.incidents.map(inc => {
                    const isOverdue = inc.age_hours > inc.sla_hours
                    return (
                      <div key={inc.id}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setDetailId(inc.id)}>
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0')} style={{ backgroundColor: group.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{inc.title}</span>
                            <StatusBadge name={inc.status_name} />
                            <span className={cn('ml-auto text-xs font-bold tabular-nums', ATTENTION_COLOR(inc.attention_score))}>
                              {inc.attention_score}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{inc.assigned_to_name || 'Unassigned'}</span>
                            <span>·</span>
                            <span>{timeAgo(inc.created_at)}</span>
                            {isOverdue && <span className="text-red-500 font-medium ml-1">SLA breached</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Incidents</h2>
        </div>
        <div className="divide-y">
          {data?.recent?.map(inc => (
            <div key={inc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setDetailId(inc.id)}>
              <div className="flex items-center gap-3 min-w-0">
                {severityBadge(inc.severity_name, inc.severity_color)}
                <span className="font-medium text-sm truncate">{inc.title}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">{timeAgo(inc.created_at)}</span>
              </div>
            </div>
          ))}
          {(!data?.recent || data.recent.length === 0) && (
            <p className="p-6 text-center text-gray-500">No recent incidents</p>
          )}
        </div>
      </div>

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

export default Dashboard
