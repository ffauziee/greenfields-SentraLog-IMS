import { NavLink } from 'react-router-dom'
export default function Sidebar({ user, onLogout, collapsed, onToggle }) {
  return (
    <div className={`bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} flex flex-col`}>
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        {!collapsed && <span className="font-bold text-lg">Greenfields</span>}
        <button onClick={onToggle} className="text-gray-400 hover:text-white text-xl">
          {collapsed ? '☰' : '✕'}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        <NavLink to="/" end
                 className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
          <span>📊</span>
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/incidents"
                 className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
          <span>⚠️</span>
          {!collapsed && <span>Incidents</span>}
        </NavLink>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
            {user.full_name?.[0] || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          )}
        </div>
        <button onClick={onLogout} className="mt-2 text-sm text-gray-400 hover:text-white w-full text-left">
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  )
}