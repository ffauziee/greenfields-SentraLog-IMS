import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import { CircleGauge, Zap, Users, ChevronLeft, History, UserCheck, LogOut } from 'lucide-react'
import { cn } from '../lib/cn'
import { isAdmin } from '../lib/roles'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', Icon: CircleGauge },
  { path: '/incidents', label: 'Incidents', Icon: Zap },
  { path: '/assigned-incidents', label: 'Assigned Incidents', Icon: UserCheck },
]

const Sidebar = memo(function Sidebar({ user, onLogout, collapsed, onToggle }) {
  const admin = isAdmin(user)

  const linkBase = 'flex items-center h-10 rounded-md text-sm whitespace-nowrap transition-colors duration-150 mx-2'
  const linkSpacing = collapsed ? 'justify-center' : 'gap-3 px-3'
  const labelVisibility = collapsed ? 'hidden' : 'opacity-100'

  return (
    <div className={cn(
      'bg-slate-900 text-white flex flex-col overflow-hidden',
      'transition-[width] duration-200 ease-in-out',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Header — logo + toggle */}
      <div className={cn('h-14 flex items-center border-b border-slate-700 shrink-0', collapsed ? 'justify-center px-0' : 'px-4')}>
        <span className={cn('font-bold tracking-wide text-blue-400 text-sm whitespace-nowrap transition-opacity duration-200', collapsed && 'hidden')}>
          GREENFIELDS IMS
        </span>
        <button onClick={onToggle} className={cn('text-slate-400 hover:text-white transition-transform duration-200 shrink-0', !collapsed && 'ml-auto')}
          style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 overflow-hidden">
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink key={path} to={path} end={path === '/'}
            className={({ isActive }) => cn(linkBase, linkSpacing, isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
            <Icon size={16} className="shrink-0" />
            <span className={cn('transition-opacity duration-200', labelVisibility)}>{label}</span>
          </NavLink>
        ))}
        {admin && ['Manage Users', 'Activity Log'].map(label => {
          const path = label === 'Manage Users' ? '/manage-users' : '/activity-log'
          const Icon = label === 'Manage Users' ? Users : History
          return (
            <NavLink key={path} to={path}
              className={({ isActive }) => cn(linkBase, linkSpacing, isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
              <Icon size={16} className="shrink-0" />
              <span className={cn('transition-opacity duration-200', labelVisibility)}>{label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User profile + sign out */}
      <div className={cn('border-t border-slate-700 overflow-hidden shrink-0', collapsed ? 'py-3' : 'p-3 space-y-3')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3 px-1')}>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            {user.full_name?.[0] || 'U'}
          </div>
          <div className={cn('min-w-0 transition-opacity duration-200', collapsed && 'hidden')}>
            <p className="text-sm font-medium truncate leading-tight">{user.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
          </div>
        </div>
        <div className={collapsed ? 'flex justify-center mt-3' : ''}>
          <button onClick={onLogout}
            className={cn(
              'text-white text-sm rounded-md bg-red-600 hover:bg-red-700 transition-all duration-200',
              collapsed ? 'w-8 h-8 p-0 flex items-center justify-center' : 'w-full py-2 px-3',
            )}>
            {collapsed ? <LogOut size={16} /> : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
})

export default Sidebar
