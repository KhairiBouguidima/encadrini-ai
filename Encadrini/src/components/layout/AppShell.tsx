import { useState, type ReactNode } from "react"
import { Logo } from "./PublicNavbar"
import { Avatar } from "../ui/Primitives"
import { IconBell, IconLogout, IconSettings, IconMenu, IconClose } from "../ui/Icons"

export interface NavItem {
  key: string
  label: string
  icon: ReactNode
  badge?: string | number | null
}

export function AppShell({
  navItems,
  activeKey,
  onNavigate,
  onExit,
  userName,
  userRole,
  userSubtitle,
  sidebarExtra,
  children,
}: {
  navItems: NavItem[]
  activeKey: string
  onNavigate: (key: string) => void
  onExit?: () => void
  userName: string
  userRole: string
  userSubtitle?: string
  sidebarExtra?: ReactNode
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNavClick = (key: string) => {
    onNavigate(key)
    setMobileOpen(false)
  }

  const renderNavContent = () => (
    <>
      <div className="px-5 py-5 border-b border-neutral-200 flex items-center justify-between">
        <button onClick={() => handleNavClick(activeKey)} className="cursor-pointer">
          <Logo />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer"
          title="Fermer le menu"
        >
          <IconClose size={20} />
        </button>
      </div>

      <nav className="px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activeKey === item.key
          return (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium font-body transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={isActive ? "text-primary-600" : "text-neutral-400"}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge !== null && item.badge !== "" && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isActive
                      ? "bg-primary-200 text-primary-800"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {sidebarExtra && (
        <div className="flex-1 px-3 py-3 border-t border-neutral-200 overflow-y-auto min-h-0 space-y-2">
          {sidebarExtra}
        </div>
      )}

      {!sidebarExtra && <div className="flex-1" />}

      <div className="px-3 py-4 border-t border-neutral-200 space-y-2 bg-neutral-50/50">
        <button
          onClick={() => handleNavClick("profile")}
          className="w-full text-left rounded-lg p-2 hover:bg-neutral-100 transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Avatar name={userName} role={userRole} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-neutral-900 truncate font-display">{userName}</p>
              <p className="text-[11px] text-neutral-500 truncate font-body">
                {userSubtitle || userRole}
              </p>
            </div>
          </div>
        </button>

        {onExit && (
          <button
            onClick={onExit}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium font-body text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <IconLogout size={18} className="text-rose-500" />
            Déconnexion
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-white border-r border-neutral-200 flex-col h-screen sticky top-0 z-20">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderNavContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 flex-shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              title="Ouvrir le menu"
            >
              <IconMenu size={22} />
            </button>
            <div className="md:hidden">
              <Logo />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigate("notifications")}
              title="Notifications"
              className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors relative cursor-pointer"
            >
              <IconBell size={18} />
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-danger-600" />
            </button>
            <button
              onClick={() => onNavigate("profile")}
              title="Paramètres"
              className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <IconSettings size={18} />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                title="Se déconnecter"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <IconLogout size={15} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
