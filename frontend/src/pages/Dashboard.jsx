import { useState, useEffect, useMemo, memo } from 'react'
import { Activity, Flame, UserX, Clock, AlertTriangle, Plus, Gauge, Zap } from 'lucide-react'
import { incidentsAPI } from '../services/api'
import { Link, useNavigate } from 'react-router-dom'
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

function SeverityBadge({ name, color }) {
  return (
    <span className="px-2 py-0.5 rounded text-white text-xs font-bold leading-none shrink-0" style={{ backgroundColor: color }}>
      {name}
    </span>
  )
}

function SectionCard({ group, renderItem, onClickItem }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"
        style={{ backgroundColor: group.color }}>
        <span className="w-2 h-2 rounded-full bg-white/80" />
        {group.name}
        <span className="ml-auto opacity-80">{group.incidents.length} incident{group.incidents.length > 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y">
        {group.incidents.map(inc => (
          <div key={inc.id}
            className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50/80 transition-colors cursor-pointer"
            onClick={() => onClickItem(inc.id)}>
            <SeverityBadge name={inc.severity_name} color={group.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm truncate">{inc.title}</span>
                {renderItem && renderItem(inc)}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{inc.assigned_to_name || 'Unassigned'}</span>
                <span>·</span>
                <span>{timeAgo(inc.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-200 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
          <div className="h-8 w-12 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

function SkeletonSection() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse mb-8">
      <div className="px-4 py-3 bg-gray-200" />
      <div className="divide-y">
        {[1,2,3].map(i => (
          <div key={i} className="px-4 py-3 flex items-start gap-3">
            <div className="h-5 w-14 rounded bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const Dashboard = memo(function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState(false)
  const { toast, showToast, closeToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    setError(false)
    incidentsAPI.dashboard()
      .then(res => setData(res.data))
      .catch(() => { setError(true); showToast('Failed to load dashboard', 'error') })
      .finally(() => setLoading(false))
  }, [refresh])

  const handleDetailUpdated = () => setRefresh(n => n + 1)

   const groupBySeverity = (incidents) => {
     const groups = {}
     for (const inc of incidents) {
       const key = inc.severity_name
       if (!groups[key]) groups[key] = { name: key, color: inc.severity_color, incidents: [] }
       groups[key].incidents.push(inc)
     }
     return Object.values(groups).sort((a, b) => (SEVERITY_ORDER[a.name] ?? 99) - (SEVERITY_ORDER[b.name] ?? 99))
   }

    const { slaBreached, highPriority } = useMemo(() => {
      if (!data?.attention_incidents) return { slaBreached: [], highPriority: [] }
      const breached = []
      const priority = []
      for (const inc of data.attention_incidents) {
        if (inc.age_hours > inc.sla_hours) {
          breached.push(inc)
        } else {
          priority.push(inc)
        }
      }
      breached.sort((a, b) => {
        const sevDiff = (b.severity_level || 0) - (a.severity_level || 0)
        if (sevDiff !== 0) return sevDiff
        return ((b.age_hours - b.sla_hours) - (a.age_hours - a.sla_hours))
      })
      priority.sort((a, b) => (b.attention_score || 0) - (a.attention_score || 0))
      return {
        slaBreached: groupBySeverity(breached),
        highPriority: groupBySeverity(priority.slice(0, 10)),
      }
    }, [data?.attention_incidents])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-36 rounded bg-gray-200 animate-pulse" />
        </div>
        <SkeletonCards />
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full bg-red-200 animate-pulse" />
          <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
        </div>
        <SkeletonSection />
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
        </div>
        <SkeletonSection />
        <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
          <div className="px-4 py-3 border-b bg-gray-100" />
          <div className="divide-y">
            {[1,2,3].map(i => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="h-5 w-14 rounded bg-gray-200" />
                <div className="h-4 flex-1 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-red-600 font-medium mb-2">Failed to load dashboard</p>
        <p className="text-sm text-gray-400 mb-4">The server may be unavailable or experiencing issues</p>
        <button onClick={() => setRefresh(n => n + 1)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors">
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gauge className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        </div>
        <button onClick={() => navigate('/incidents')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} />
          Create Incident
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {STAT_CARDS.map(card => {
          const Icon = card.icon
          const count = data?.[card.key] ?? 0
          const inner = (
            <div className={cn('bg-white rounded-xl shadow-sm p-4 border-l-4 transition-all duration-150', card.border, card.link && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer')}>
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
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            SLA Breached
            {slaBreached.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({slaBreached.reduce((s, g) => s + g.incidents.length, 0)})</span>
            )}
          </h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline">View All &rarr;</Link>
        </div>

        {slaBreached.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No SLA breached incidents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {slaBreached.map(group => (
              <SectionCard key={group.name} group={group} onClickItem={setDetailId}
                renderItem={(inc) => {
                  const overdueHours = Math.round((inc.age_hours - inc.sla_hours) * 10) / 10
                  return <span className="ml-auto text-xs font-bold text-red-600 whitespace-nowrap shrink-0">Overdue {overdueHours}h</span>
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            High Priority
            {highPriority.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({highPriority.reduce((s, g) => s + g.incidents.length, 0)})</span>
            )}
          </h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline">View All &rarr;</Link>
        </div>

        {highPriority.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No high priority incidents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {highPriority.map(group => (
              <SectionCard key={group.name} group={group} onClickItem={setDetailId}
                renderItem={(inc) => (
                  <span className={cn('ml-auto text-xs font-bold tabular-nums shrink-0', ATTENTION_COLOR(inc.attention_score))}>
                    Score {inc.attention_score}
                  </span>
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Recent Incidents</h2>
        </div>
        <div className="divide-y">
           {data?.recent
             ?.slice()
             .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
             .map(inc => (
             <div key={inc.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-gray-50/80 transition-colors cursor-pointer"
               onClick={() => setDetailId(inc.id)}>
               <SeverityBadge name={inc.severity_name} color={inc.severity_color} />
               <span className="font-medium text-sm truncate flex-1">{inc.title}</span>
               <span className="text-xs text-gray-400 shrink-0">{timeAgo(inc.created_at)}</span>
             </div>
           ))}
          {(!data?.recent || data.recent.length === 0) && (
            <p className="p-8 text-center text-gray-500 text-sm">No recent incidents</p>
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
