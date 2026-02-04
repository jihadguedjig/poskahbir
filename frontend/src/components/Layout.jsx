import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Flame, 
  PlusCircle, 
  CreditCard, 
  Settings, 
  LogOut,
  User,
  ChevronDown,
  UserCircle
} from 'lucide-react'
import RestaurantTableIcon from './RestaurantTableIcon'
import { useState } from 'react'

export default function Layout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { 
      to: '/new-order', 
      icon: PlusCircle, 
      label: 'New Order',
      roles: ['admin', 'moderator', 'server']
    },
    { 
      to: '/my-tables', 
      icon: RestaurantTableIcon, 
      label: 'My Tables',
      labelAllTables: 'All Tables', // shown for admin/moderator
      roles: ['admin', 'moderator', 'server']
    },
    { 
      to: '/cashier', 
      icon: CreditCard, 
      label: 'Cashier',
      roles: ['admin', 'moderator', 'cashier']
    },
    { 
      to: '/admin', 
      icon: Settings, 
      label: 'Admin',
      labelModerator: 'Moderation',
      roles: ['admin', 'moderator']
    },
  ]

  const filteredNavItems = navItems.filter(item => 
    item.roles.some(role => hasRole(role))
  )

  const navLabel = (item) => {
    if (item.labelModerator && hasRole('moderator') && !hasRole('admin'))
      return item.labelModerator
    if (item.labelAllTables && (hasRole('admin') || hasRole('moderator')))
      return item.labelAllTables
    return item.label
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col lg:flex-row">
      {/* Menu: fixed top on mobile, left sidebar on desktop */}
      <aside className="fixed top-0 left-0 right-0 z-50 h-14 lg:h-auto lg:relative lg:z-auto lg:w-20 xl:w-64 bg-surface-900 text-white flex flex-row lg:flex-col lg:min-h-screen">
        {/* Logo - mobile: left; desktop: top */}
        <div className="flex-shrink-0 p-2 lg:p-4 flex items-center justify-center lg:justify-start gap-2 lg:gap-3 border-b-0 lg:border-b border-surface-700 border-r lg:border-r-0 border-surface-700">
          <Flame className="w-7 h-7 lg:w-8 lg:h-8 text-primary-500" />
          <span className="text-sm font-bold lg:hidden">Showaya</span>
          <span className="hidden lg:block text-xl font-bold">Showaya POS</span>
        </div>

        {/* Navigation - horizontal scroll on mobile, vertical on desktop */}
        <nav className="flex-1 flex flex-row lg:flex-col gap-0 lg:gap-0 overflow-x-auto lg:overflow-visible scrollbar-hide min-w-0 p-1 lg:p-2 xl:p-4 lg:space-y-0">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-shrink-0 flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 lg:w-6 lg:h-6" />
              <span className="hidden lg:block font-medium whitespace-nowrap xl:inline">{navLabel(item)}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section - right on mobile, bottom on desktop */}
        <div className="flex-shrink-0 p-1 lg:p-2 xl:p-4 lg:border-t border-surface-700 border-l lg:border-l-0 border-surface-700">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-2 lg:px-4 py-2.5 lg:py-3 rounded-lg hover:bg-surface-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="hidden xl:block text-left flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{user?.fullName}</div>
                <div className="text-xs text-surface-400 capitalize">{user?.role}</div>
              </div>
              <ChevronDown className="hidden xl:block w-4 h-4 text-surface-400 flex-shrink-0" />
            </button>

            {/* User menu dropdown - below on mobile, above on desktop */}
            {showUserMenu && (
              <div className="absolute right-0 lg:right-auto lg:left-0 top-full lg:top-auto lg:bottom-full mt-1 lg:mt-0 lg:mb-2 min-w-[140px] lg:min-w-full bg-surface-800 rounded-lg shadow-lg overflow-hidden border border-surface-600">
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-700 transition-colors text-sm"
                >
                  <UserCircle className="w-5 h-5 flex-shrink-0" />
                  <span>Profile</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-surface-700 transition-colors text-sm"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content - padding-top on mobile so content is below fixed bar */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
