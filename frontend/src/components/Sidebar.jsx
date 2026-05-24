import { memo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { CircleGauge, Zap, Users, ChevronLeft, History, UserCheck, LogOut, Shield } from 'lucide-react'
import { cn } from '../lib/cn'
import { isAdmin } from '../lib/roles'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', Icon: CircleGauge },
  { path: '/incidents', label: 'Incidents', Icon: Zap },
  { path: '/assigned-incidents', label: 'Assigned Incidents', Icon: UserCheck },
]

const ADMIN_ITEMS = [
  { path: '/manage-users', label: 'Manage Users', Icon: Users },
  { path: '/activity-log', label: 'Activity Log', Icon: History },
]

const Sidebar = memo(function Sidebar({ user, onLogout, collapsed, onToggle }) {
  const admin = isAdmin(user)
  const navigate = useNavigate()

  return (
    <div className={cn(
      'bg-slate-900 text-white flex flex-col',
      'transition-all duration-200 ease-in-out shrink-0',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* ── Header ── */}
      <div className={cn(
        'h-14 flex items-center border-b border-slate-700/60 shrink-0',
        collapsed ? 'justify-center' : 'px-4',
      )}>
        <div className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'hidden')}>
          <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center shrink-0">
            <Shield size={14} className="text-white" />
          </div>
          <span className="font-bold tracking-tight text-blue-400 text-sm whitespace-nowrap">
            GREENFIELDS
          </span>
        </div>
        <button onClick={onToggle}
          className={cn(
            'text-slate-500 hover:text-white transition-all duration-200 shrink-0 rounded-md hover:bg-slate-800',
            collapsed ? 'mx-auto' : 'ml-auto',
            'w-7 h-7 flex items-center justify-center',
          )}>
          <ChevronLeft size={15} className={cn('transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* ── Nav Links ── */}
      <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 scrollbar-thin">
        <div className={cn('px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500', collapsed && 'hidden')}>
          Navigation
        </div>
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink key={path} to={path} end={path === '/'}
            className={({ isActive }) => cn(
              'flex items-center h-9 rounded-none text-sm whitespace-nowrap transition-all duration-150',
              collapsed ? 'justify-center' : 'gap-3 px-4',
              isActive
                ? 'bg-blue-600/15 text-blue-400 font-medium border-r-2 border-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}>
            <Icon size={16} className="shrink-0" />
            <span className={cn('transition-opacity duration-200', collapsed && 'hidden')}>{label}</span>
          </NavLink>
        ))}

        {admin && (
          <>
            <div className={cn('pt-3 pb-1.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500', collapsed && 'hidden')}>
              Admin
            </div>
            {ADMIN_ITEMS.map(({ path, label, Icon }) => (
              <NavLink key={path} to={path}
                className={({ isActive }) => cn(
                  'flex items-center h-9 rounded-none text-sm whitespace-nowrap transition-all duration-150',
                  collapsed ? 'justify-center' : 'gap-3 px-4',
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-medium border-r-2 border-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                )}>
                <Icon size={16} className="shrink-0" />
                <span className={cn('transition-opacity duration-200', collapsed && 'hidden')}>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* ── Account ── */}
      <div className="border-t border-slate-700/60 shrink-0">
        <div className={cn('px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500', collapsed && 'hidden')}>
          Account
        </div>
        <button onClick={() => navigate('/profile')}
          className={cn(
            'flex items-center w-full transition-all duration-150',
            collapsed ? 'justify-center h-12' : 'gap-3 px-4 py-2.5',
            'hover:bg-slate-800/60 text-left',
          )}>
          <div className="w-8 h-8 rounded-full shrink-0 font-bold text-white text-xs bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
            <p className="text-sm font-medium truncate leading-tight text-white">{user.full_name || user.username}</p>
            <p className="text-[11px] text-slate-400 capitalize mt-0.5">{user.role}</p>
          </div>
        </button>
        <button onClick={onLogout}
          className={cn(
            'flex items-center w-full transition-all duration-150 text-sm',
            collapsed ? 'justify-center h-9' : 'gap-3 px-4 py-2',
            'text-slate-400 hover:text-red-400 hover:bg-red-500/10',
          )}>
          <LogOut size={15} className="shrink-0" />
          <span className={cn(collapsed && 'hidden')}>Sign Out</span>
        </button>
        <div className="pb-2" />
      </div>
    </div>
  )
})

export default Sidebar
