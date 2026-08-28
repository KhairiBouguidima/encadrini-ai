import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { IconStats, IconStudent, IconReport, IconSettings, IconSearch } from "../../components/ui/Icons"
import { api, type AdminProject, type AdminUser, type PlatformStats, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble", icon: <IconStats size={18} /> },
  { key: "users", label: "Comptes", icon: <IconStudent size={18} /> },
  { key: "projects", label: "Projets PFE", icon: <IconReport size={18} /> },
  { key: "settings", label: "Parametres", icon: <IconSettings size={18} /> },
]

function roleLabel(role: AdminUser["role"]) {
  if (role === "STUDENT") return "Etudiant"
  if (role === "ENCADRER") return "Encadreur"
  return "Admin"
}

function accountStatus(active: boolean): BadgeVariant {
  return active ? "accepted" : "pending"
}

function projectStatus(project: AdminProject): BadgeVariant {
  if (!project.report_count) return "draft"
  if (project.latest_version) return "analysed"
  return "reviewing"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  )
}

export function AdminDashboard({ onExit, user }: { onExit: () => void; user?: User | null }) {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [accounts, setAccounts] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Administrateur"

  const statCards = useMemo(
    () => [
      { label: "Projets actifs", value: String(stats?.total_projects ?? 0) },
      { label: "Comptes etudiants", value: String(stats?.total_students ?? 0) },
      { label: "Comptes encadreurs", value: String(stats?.total_encadrers ?? 0) },
      {
        label: "Score de qualite moyen",
        value: stats?.ai_analysis_avg_quality != null ? `${stats.ai_analysis_avg_quality}/100` : "-",
      },
    ],
    [stats],
  )

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setNotice("")
      try {
        const [statsData, userData, projectData] = await Promise.all([
          api.getAdminStats(),
          api.getAdminUsers(search),
          api.getAdminProjects(search),
        ])
        if (!isMounted) return
        setStats(statsData)
        setAccounts(userData.users)
        setProjects(projectData.projects)
      } catch (err) {
        if (isMounted) setNotice(err instanceof Error ? err.message : "Impossible de charger les donnees admin.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    const timer = window.setTimeout(load, 250)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [search])

  const toggleUser = async (account: AdminUser) => {
    setNotice("")
    try {
      const updated = await api.updateAdminUser(account.id, { is_active: !account.is_active })
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Mise a jour impossible.")
    }
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey="overview"
      onNavigate={() => {}}
      onExit={onExit}
      userName={userName}
      userRole="Administrateur plateforme"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold font-display text-neutral-900">Vue d'ensemble</h1>
          <div className="flex items-center gap-2 border border-neutral-300 rounded-lg px-3 py-2 bg-white w-64">
            <IconSearch size={15} className="text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher..."
              className="flex-1 text-sm font-body focus:outline-none"
            />
          </div>
        </div>

        {notice && (
          <p className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-body">
            {notice}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          {statCards.map((s) => (
            <Card key={s.label}>
              <p className="text-xs font-medium font-body text-neutral-500 mb-2">{s.label}</p>
              <p className="text-2xl font-bold font-display text-neutral-900">{isLoading ? "..." : s.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <Card>
            <h2 className="font-semibold font-display text-neutral-800 mb-5">Activite plateforme</h2>
            <div className="space-y-3 text-sm font-body">
              <div className="flex justify-between"><span className="text-neutral-500">Utilisateurs actifs</span><strong>{stats?.active_users ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Rapports</span><strong>{stats?.total_reports ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Versions deposees</span><strong>{stats?.total_report_versions ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Annotations</span><strong>{stats?.total_annotations ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Analyses IA</span><strong>{stats?.total_ai_analyses ?? 0}</strong></div>
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="font-semibold font-display text-neutral-800">Projets PFE recents</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {projects.length === 0 && <p className="px-5 py-4 text-sm text-neutral-500">Aucun projet trouve.</p>}
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-body text-neutral-800 truncate">{p.title}</p>
                    <p className="text-xs text-neutral-400 font-body">
                      {p.student_email ?? "Etudiant inconnu"} - {formatDate(p.created_at)}
                    </p>
                  </div>
                  <StatusBadge variant={projectStatus(p)} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card padded={false}>
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-semibold font-display text-neutral-800">Gestion des comptes</h2>
          </div>
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                <th className="font-medium px-5 py-3">Nom</th>
                <th className="font-medium px-5 py-3">Role</th>
                <th className="font-medium px-5 py-3">Email</th>
                <th className="font-medium px-5 py-3">Statut</th>
                <th className="font-medium px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-neutral-500">Aucun compte trouve.</td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3.5 text-neutral-800 font-medium">{a.first_name} {a.last_name}</td>
                  <td className="px-5 py-3.5 text-neutral-500">{roleLabel(a.role)}</td>
                  <td className="px-5 py-3.5 text-neutral-500">{a.email}</td>
                  <td className="px-5 py-3.5"><StatusBadge variant={accountStatus(a.is_active)} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="text-primary-600 font-medium hover:underline" onClick={() => toggleUser(a)}>
                      {a.is_active ? "Desactiver" : "Activer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  )
}
