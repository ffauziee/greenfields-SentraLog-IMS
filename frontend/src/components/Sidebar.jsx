import { NavLink } from 'react-router-dom'
import { CircleGauge, Zap, Users, ChevronLeft } from 'lucide-react'

const iconMap = { Dashboard: CircleGauge, Incidents: Zap }

export default function Sidebar({ user, onLogout, collapsed, onToggle }) {
  const isAdmin = user?.role === 'admin'

  return (
    <div className={`bg-slate-900 text-white flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`h-14 flex items-center border-b border-slate-700 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <div className={`transition-opacity duration-200 ${collapsed ? 'hidden' : 'opacity-100'}`}>
          <span className="font-bold tracking-wide text-blue-400 text-sm whitespace-nowrap">GREENFIELDS IMS</span>
        </div>
        <button onClick={onToggle}
                className={`text-slate-400 hover:text-white transition-transform duration-200 shrink-0 ${collapsed ? '' : 'ml-auto'}`}
                style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronLeft size={16} />
        </button>
      </div>

      <nav className="flex-1 py-3 overflow-hidden">
        {(['Dashboard', 'Incidents']).map(label => {
          const path = label === 'Dashboard' ? '/' : `/${label.toLowerCase()}`
          const Icon = iconMap[label]
          return (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center h-10 rounded-md text-sm whitespace-nowrap transition-colors duration-150 mx-2 ${
                  collapsed ? 'justify-center' : 'gap-3 px-3'
                } ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? 'hidden' : 'opacity-100'}`}>
                {label}
              </span>
            </NavLink>
          )
        })}
        {isAdmin && (
          <NavLink
            to="/manage-users"
            className={({ isActive }) =>
              `flex items-center h-10 rounded-md text-sm whitespace-nowrap transition-colors duration-150 mx-2 ${
                collapsed ? 'justify-center' : 'gap-3 px-3'
              } ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Users size={16} className="shrink-0" />
            <span className={`transition-opacity duration-200 ${collapsed ? 'hidden' : 'opacity-100'}`}>
              Manage Users
            </span>
          </NavLink>
        )}
      </nav>

      <div className={`border-t border-slate-700 overflow-hidden shrink-0 ${collapsed ? 'py-3' : 'p-3 space-y-3'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-1'}`}>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            {user.full_name?.[0] || 'U'}
          </div>
          <div className={`min-w-0 transition-opacity duration-200 ${collapsed ? 'hidden' : 'opacity-100'}`}>
            <p className="text-sm font-medium truncate leading-tight">{user.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
          </div>
        </div>
        <div className={collapsed ? 'flex justify-center mt-3' : ''}>
          <button onClick={onLogout}
                  className={`text-white text-sm rounded-md bg-red-600 hover:bg-red-700 transition-all duration-200 ${
                    collapsed ? 'w-8 h-8 p-0 flex items-center justify-center' : 'w-full py-2 px-3'
                  }`}>
            {collapsed ? '×' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
