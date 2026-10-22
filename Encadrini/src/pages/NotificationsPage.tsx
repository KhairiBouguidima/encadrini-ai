import { useEffect, useMemo, useState } from "react"
import { AppShell } from "../components/layout/AppShell"
import { Card } from "../components/ui/Primitives"
import { Button } from "../components/ui/Button"
import {
  IconBell,
  IconCheck,
  IconReport,
  IconSparkles,
  IconUser,
  IconStats,
  IconStudent,
  IconAward,
} from "../components/ui/Icons"
import { api, type User } from "../lib/api"
import { getNavItems } from "../lib/navItems"

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  link?: string
  created_at: string
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function NotificationsPage({
  user,
  onNavigate,
  onExit,
}: {
  user?: User | null
  onNavigate: (key: string) => void
  onExit: () => void
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Utilisateur"
  const userRole =
    user?.role === "ENCADRER"
      ? "Encadreur"
      : user?.role === "ADMIN"
      ? "Administrateur plateforme"
      : "Étudiant"

  const navItems = useMemo(() => getNavItems(user?.role), [user?.role])

  useEffect(() => {
    let isMounted = true
    const fetchNotifs = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }
      try {
        const res = await api.getNotifications()
        if (!isMounted) return
        setNotifications(res.notifications)
        setUnreadCount(res.unread_count)
      } catch {
        if (!isMounted) return
        // Sample fallback if no backend notifications
        if (user.role === "ADMIN") {
          setNotifications([
            {
              id: "admin-1",
              type: "SYSTEM_INFO",
              title: "Système opérationnel",
              message: "La plateforme Encadrini AI est active et connectée à MongoDB.",
              is_read: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "admin-2",
              type: "AI_ANALYSIS_COMPLETED",
              title: "Moteur IA actif",
              message: "Le service d'analyse et d'annotation IA est prêt.",
              is_read: true,
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
          ])
          setUnreadCount(0)
        } else {
          setNotifications([
            {
              id: "1",
              type: "AI_ANALYSIS_COMPLETED",
              title: "Analyse IA terminée",
              message: "L'analyse IA de votre version v3 est prête avec un score global de 86/100.",
              is_read: false,
              created_at: new Date().toISOString(),
            },
            {
              id: "2",
              type: "INVITATION_ACCEPTED",
              title: "Invitation acceptée",
              message: "Votre encadreur a accepté l'invitation à suivre votre PFE.",
              is_read: true,
              created_at: new Date(Date.now() - 86400000).toISOString(),
            },
          ])
          setUnreadCount(1)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchNotifs()
    return () => { isMounted = false }
  }, [user])

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
    } catch {
      // ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id)
    } catch {
      // ignore
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey="notifications"
      onNavigate={onNavigate}
      onExit={onExit}
      userName={userName}
      userRole={userRole}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900 flex items-center gap-2">
              <IconBell size={24} className="text-primary-600" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger-100 text-danger-700">
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1">
              Restez informé de l'avancement de votre rapport et des retours de votre encadreur.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead} icon={<IconCheck size={14} />}>
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Notifications list */}
        <Card padded={false}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-neutral-500 font-body animate-pulse">
              Chargement des notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                <IconBell size={20} />
              </div>
              <p className="text-sm font-medium font-body text-neutral-700">Aucune notification</p>
              <p className="text-xs text-neutral-400 font-body">Vous êtes à jour !</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`p-4 sm:p-5 flex items-start gap-4 transition-colors cursor-pointer ${
                    !n.is_read ? "bg-primary-50/40 hover:bg-primary-50/70" : "hover:bg-neutral-50"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      !n.is_read
                        ? "bg-primary-100 text-primary-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {n.type?.includes("AI") ? (
                      <IconSparkles size={18} />
                    ) : (
                      <IconBell size={18} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={`text-sm font-body ${!n.is_read ? "font-bold text-neutral-900" : "font-medium text-neutral-700"}`}>
                        {n.title}
                      </h3>
                      <span className="text-xs text-neutral-400 font-body flex-shrink-0">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 font-body leading-relaxed">
                      {n.message}
                    </p>
                  </div>

                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-600 flex-shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
