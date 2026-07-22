import type { ReactNode } from "react"
import { Logo } from "./PublicNavbar"
import { Avatar } from "../ui/Primitives"
import { IconBell, IconSettings } from "../ui/Icons"

export interface NavItem {
  key: string
  label: string
  icon: ReactNode
}

export function AppShell({
  navItems,
  activeKey,
  onNavigate,
  onExit,
  userName,
  userRole,
  children,
}: {
  navItems: NavItem[]
  activeKey: string
  onNavigate: (key: string) => void
  onExit?: () => void
  userName: string
  userRole: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="w-64 flex-shrink-0 bg-white border-r border-neutral-200 flex flex-col">
        <div className="px-5 py-5 border-b border-neutral-200">
          <button onClick={onExit} className="cursor-pointer">
            <Logo />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium font-body transition-colors ${
                activeKey === item.key
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className={activeKey === item.key ? "text-primary-600" : "text-neutral-400"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-neutral-200">
          <Avatar name={userName} role={userRole} size="sm" />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 flex-shrink-0 bg-white border-b border-neutral-200 flex items-center justify-end gap-4 px-6">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors relative">
            <IconBell size={18} />
            <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-danger-600" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors">
            <IconSettings size={18} />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
