import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import {
  IconStats,
  IconStudent,
  IconReport,
  IconSearch,
  IconBell,
  IconUser,
  IconPlus,
  IconTrash,
  IconCheck,
  IconDownload,
  IconChevronRight,
  IconFileText,
} from "../../components/ui/Icons"
import {
  api,
  type AdminProject,
  type AdminUser,
  type PlatformStats,
  type User,
  type UserRole,
} from "../../lib/api"

const navItems: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble", icon: <IconStats size={18} /> },
  { key: "users", label: "Gestion des comptes", icon: <IconStudent size={18} /> },
  { key: "projects", label: "Projets PFE", icon: <IconReport size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil", icon: <IconUser size={18} /> },
]

function roleLabel(role: UserRole) {
  if (role === "STUDENT") return "Étudiant"
  if (role === "ENCADRER") return "Encadreur"
  return "Administrateur"
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
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function AdminDashboard({
  onExit,
  onNavigate,
  user,
  initialTab = "overview",
}: {
  onExit: () => void
  onNavigate?: (key: string) => void
  user?: User | null
  initialTab?: "overview" | "users" | "projects"
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "projects">(initialTab)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [accounts, setAccounts] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modal State for user creation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState("")
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    faculty: "",
    role: "ENCADRER" as UserRole,
    is_active: true,
  })

  // Selected project for quick view modal
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null)

  // Admin Assignment States
  const [assignSupervisorEmail, setAssignSupervisorEmail] = useState("")
  const [assignSupervisorRole, setAssignSupervisorRole] = useState("ACADEMIC")
  const [isAssigningSupervisor, setIsAssigningSupervisor] = useState(false)
  const [assignBinomeEmail, setAssignBinomeEmail] = useState("")
  const [isAssigningBinome, setIsAssigningBinome] = useState(false)
  const [assignNotice, setAssignNotice] = useState("")

  const handleAssignSupervisor = async () => {
    if (!selectedProject || !assignSupervisorEmail.trim()) return
    setIsAssigningSupervisor(true)
    setAssignNotice("")
    try {
      await api.adminAssignSupervisor(selectedProject.id, assignSupervisorEmail.trim(), assignSupervisorRole)
      setAssignNotice(`Superviseur assigné avec succès (${assignSupervisorRole}) !`)
      setAssignSupervisorEmail("")
      await loadData()
    } catch (err) {
      setAssignNotice(err instanceof Error ? err.message : "Erreur lors de l'assignation.")
    } finally {
      setIsAssigningSupervisor(false)
    }
  }

  const handleAssignBinome = async () => {
    if (!selectedProject || !assignBinomeEmail.trim()) return
    setIsAssigningBinome(true)
    setAssignNotice("")
    try {
      await api.adminAssignBinome(selectedProject.id, assignBinomeEmail.trim())
      setAssignNotice("Binôme rattaché au projet avec succès !")
      setAssignBinomeEmail("")
      await loadData()
    } catch (err) {
      setAssignNotice(err instanceof Error ? err.message : "Erreur lors du rattachement du binôme.")
    } finally {
      setIsAssigningBinome(false)
    }
  }

  // Sync initialTab when props change
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  const userName = user ? `${user.first_name} ${user.last_name}` : "Administrateur"

  const statCards = useMemo(
    () => [
      { label: "Projets actifs", value: String(stats?.total_projects ?? 0) },
      { label: "Comptes étudiants", value: String(stats?.total_students ?? 0) },
      { label: "Comptes encadreurs", value: String(stats?.total_encadrers ?? 0) },
      {
        label: "Score qualité IA moyen",
        value: stats?.ai_analysis_avg_quality != null ? `${stats.ai_analysis_avg_quality}/100` : "-",
      },
    ],
    [stats],
  )

  const loadData = async (query = search, role = roleFilter) => {
    setIsLoading(true)
    try {
      const [statsData, userData, projectData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(query, role),
        api.getAdminProjects(query),
      ])
      setStats(statsData)
      setAccounts(userData.users)
      setProjects(projectData.projects)
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Impossible de charger les données administrateur.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (isMounted) loadData(search, roleFilter)
    }, 250)
    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [search, roleFilter])

  // Clear notice after 4 seconds
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const handleNavClick = (key: string) => {
    if (key === "overview" || key === "users" || key === "projects") {
      setActiveTab(key)
    } else if (onNavigate) {
      onNavigate(key)
    }
  }

  // Filter accounts by status client-side
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (statusFilter === "ACTIVE") return a.is_active
      if (statusFilter === "INACTIVE") return !a.is_active
      return true
    })
  }, [accounts, statusFilter])

  const countsByRole = useMemo(() => {
    return {
      all: accounts.length,
      students: accounts.filter((a) => a.role === "STUDENT").length,
      supervisors: accounts.filter((a) => a.role === "ENCADRER").length,
      admins: accounts.filter((a) => a.role === "ADMIN").length,
      active: accounts.filter((a) => a.is_active).length,
      inactive: accounts.filter((a) => !a.is_active).length,
    }
  }, [accounts])

  const toggleUser = async (account: AdminUser) => {
    try {
      const updated = await api.updateAdminUser(account.id, { is_active: !account.is_active })
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setNotice({
        type: "success",
        text: `Compte de ${account.first_name} ${account.last_name} ${updated.is_active ? "activé" : "désactivé"}.`,
      })
      if (stats) {
        setStats({
          ...stats,
          active_users: stats.active_users + (updated.is_active ? 1 : -1),
        })
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Mise à jour impossible.",
      })
    }
  }

  const handleChangeRole = async (account: AdminUser, newRole: UserRole) => {
    try {
      const updated = await api.updateAdminUser(account.id, { role: newRole })
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setNotice({
        type: "success",
        text: `Rôle de ${account.first_name} changé en ${roleLabel(newRole)}.`,
      })
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Changement de rôle impossible.",
      })
    }
  }

  const handleDeleteUser = async (account: AdminUser) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir désactiver définitivement le compte de ${account.first_name} ${account.last_name} (${account.email}) ?`,
      )
    ) {
      return
    }
    try {
      await api.deleteAdminUser(account.id)
      setAccounts((prev) =>
        prev.map((item) => (item.id === account.id ? { ...item, is_active: false } : item)),
      )
      setNotice({
        type: "success",
        text: `Compte ${account.email} désactivé avec succès.`,
      })
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Suppression impossible.",
      })
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError("")

    if (!newUser.first_name.trim() || !newUser.last_name.trim()) {
      setModalError("Veuillez saisir le prénom et le nom.")
      return
    }
    if (!newUser.email.trim() || !newUser.email.includes("@")) {
      setModalError("Veuillez saisir une adresse email valide.")
      return
    }
    if (!newUser.password || newUser.password.length < 6) {
      setModalError("Le mot de passe doit comporter au moins 6 caractères.")
      return
    }

    setIsSubmitting(true)
    try {
      const created = await api.createAdminUser(newUser)
      setAccounts((prev) => [created, ...prev])
      setIsModalOpen(false)
      setNewUser({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        faculty: "",
        role: "ENCADRER",
        is_active: true,
      })
      setNotice({
        type: "success",
        text: `Compte ${roleLabel(created.role)} créé avec succès pour ${created.first_name} ${created.last_name}.`,
      })
      // Refresh stats
      loadData(search, roleFilter)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erreur lors de la création du compte.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Export CSV helpers
  const exportUsersCSV = () => {
    const headers = ["Nom", "Prénom", "Email", "Rôle", "Faculté", "Statut", "Date de création"]
    const rows = filteredAccounts.map((a) => [
      `"${a.last_name}"`,
      `"${a.first_name}"`,
      `"${a.email}"`,
      `"${roleLabel(a.role)}"`,
      `"${a.faculty || ""}"`,
      `"${a.is_active ? "Actif" : "Inactif"}"`,
      `"${formatDate(a.created_at)}"`,
    ])
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `comptes_encadrini_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportProjectsCSV = () => {
    const headers = [
      "Titre du Projet",
      "Email Étudiant",
      "Email Encadreur(s)",
      "Nombre de versions",
      "Dernière version",
      "Date de création",
    ]
    const rows = projects.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.student_email || ""}"`,
      `"${p.encadrer_email || ""}"`,
      p.report_count,
      p.latest_version || 0,
      `"${formatDate(p.created_at)}"`,
    ])
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `projets_encadrini_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey={activeTab}
      onNavigate={handleNavClick}
      onExit={onExit}
      userName={userName}
      userRole="Administrateur plateforme"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">
              {activeTab === "overview" && "Vue d'ensemble"}
              {activeTab === "users" && "Gestion des Comptes"}
              {activeTab === "projects" && "Supervision des Projets PFE"}
            </h1>
            <p className="text-sm font-body text-neutral-500 mt-1">
              {activeTab === "overview" && "Statistiques globales, activité de la plateforme et accès rapide."}
              {activeTab === "users" && "Administrez les étudiants, encadreurs et administrateurs."}
              {activeTab === "projects" && "Consultez tous les projets PFE et le dépôt des rapports."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="flex items-center gap-2 border border-neutral-300 rounded-lg px-3 py-2 bg-white w-64 shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
              <IconSearch size={16} className="text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 text-sm font-body focus:outline-none bg-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action button to add user */}
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setModalError("")
                setIsModalOpen(true)
              }}
            >
              Nouveau compte
            </Button>
          </div>
        </div>

        {/* Floating Notification Banner */}
        {notice && (
          <div
            className={`p-3.5 rounded-lg text-sm font-body flex items-center justify-between border ${
              notice.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" && <IconCheck size={16} className="text-green-600" />}
              <span>{notice.text}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs font-semibold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* ──────────────── TAB: OVERVIEW ──────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {statCards.map((s) => (
                <Card key={s.label}>
                  <p className="text-xs font-medium font-body text-neutral-500 mb-2">{s.label}</p>
                  <p className="text-2xl font-bold font-display text-neutral-900">
                    {isLoading ? "..." : s.value}
                  </p>
                </Card>
              ))}
            </div>

            {/* Platform Activity + Recent Projects */}
            <div className="grid md:grid-cols-2 gap-5">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold font-display text-neutral-800">Activité plateforme</h2>
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                    Temps réel
                  </span>
                </div>
                <div className="space-y-3.5 text-sm font-body divide-y divide-neutral-100">
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Utilisateurs actifs</span>
                    <strong>{stats?.active_users ?? 0} / {stats?.total_users ?? 0}</strong>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Total Projets PFE</span>
                    <strong>{stats?.total_projects ?? 0}</strong>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Rapports déposés</span>
                    <strong>{stats?.total_reports ?? 0}</strong>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Versions déposées</span>
                    <strong>{stats?.total_report_versions ?? 0}</strong>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Annotations formulées</span>
                    <strong>{stats?.total_annotations ?? 0}</strong>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-neutral-500">Analyses IA exécutées</span>
                    <strong>{stats?.total_ai_analyses ?? 0}</strong>
                  </div>
                </div>
              </Card>

              <Card padded={false}>
                <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                  <h2 className="font-semibold font-display text-neutral-800">Projets PFE récents</h2>
                  <button
                    onClick={() => setActiveTab("projects")}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    Voir tous ({projects.length}) <IconChevronRight size={14} />
                  </button>
                </div>
                <div className="divide-y divide-neutral-100 max-h-[310px] overflow-y-auto">
                  {projects.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-neutral-400 font-body">
                      Aucun projet trouvé.
                    </p>
                  )}
                  {projects.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium font-body text-neutral-800 truncate">{p.title}</p>
                        <p className="text-xs text-neutral-400 font-body truncate">
                          Étudiant: {p.student_email ?? "Non assigné"} • {formatDate(p.created_at)}
                        </p>
                      </div>
                      <StatusBadge variant={projectStatus(p)} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Recent Accounts Preview */}
            <Card padded={false}>
              <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold font-display text-neutral-800">Comptes utilisateurs récents</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Derniers comptes enregistrés sur la plateforme.</p>
                </div>
                <button
                  onClick={() => setActiveTab("users")}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  Gérer tous les comptes ({accounts.length}) <IconChevronRight size={14} />
                </button>
              </div>
              <div className="divide-y divide-neutral-100">
                {accounts.slice(0, 5).map((a) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50">
                    <Avatar name={`${a.first_name} ${a.last_name}`} role={a.email} size="sm" />
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        {roleLabel(a.role)}
                      </span>
                      <StatusBadge variant={accountStatus(a.is_active)} />
                      <button
                        className="text-xs font-medium text-primary-600 hover:underline"
                        onClick={() => toggleUser(a)}
                      >
                        {a.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ──────────────── TAB: USERS ──────────────── */}
        {activeTab === "users" && (
          <Card padded={false}>
            {/* Header with Role Filter Tabs & Export */}
            <div className="px-5 py-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold font-display text-neutral-800 text-lg">
                  Liste des Utilisateurs ({filteredAccounts.length})
                </h2>
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                  <span>{countsByRole.students} étudiant(s)</span>
                  <span>•</span>
                  <span>{countsByRole.supervisors} encadreur(s)</span>
                  <span>•</span>
                  <span>{countsByRole.admins} admin(s)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Role filter pills */}
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                  {[
                    { key: "", label: `Tous (${countsByRole.all})` },
                    { key: "STUDENT", label: `Étudiants (${countsByRole.students})` },
                    { key: "ENCADRER", label: `Encadreurs (${countsByRole.supervisors})` },
                    { key: "ADMIN", label: `Admins (${countsByRole.admins})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRoleFilter(tab.key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        roleFilter === tab.key
                          ? "bg-white text-neutral-900 shadow-sm font-semibold"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="ACTIVE">Actifs uniquement ({countsByRole.active})</option>
                  <option value="INACTIVE">Inactifs uniquement ({countsByRole.inactive})</option>
                </select>

                {/* Export CSV button */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IconDownload size={14} />}
                  onClick={exportUsersCSV}
                  title="Exporter la liste en format CSV"
                >
                  Exporter CSV
                </Button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="text-left text-xs text-neutral-400 bg-neutral-50 border-b border-neutral-200">
                    <th className="font-medium px-5 py-3">Utilisateur</th>
                    <th className="font-medium px-5 py-3">Rôle</th>
                    <th className="font-medium px-5 py-3">Faculté / Établissement</th>
                    <th className="font-medium px-5 py-3">Statut</th>
                    <th className="font-medium px-5 py-3">Date de création</th>
                    <th className="font-medium px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-neutral-400 font-body">
                        {isLoading ? "Chargement des utilisateurs..." : "Aucun utilisateur trouvé selon vos critères."}
                      </td>
                    </tr>
                  )}
                  {filteredAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Avatar name={`${a.first_name} ${a.last_name}`} role={a.email} size="sm" />
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={a.role}
                          onChange={(e) => handleChangeRole(a, e.target.value as UserRole)}
                          className="text-xs font-medium border border-neutral-200 rounded-md px-2 py-1 bg-white hover:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                        >
                          <option value="STUDENT">Étudiant</option>
                          <option value="ENCADRER">Encadreur</option>
                          <option value="ADMIN">Administrateur</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-600 text-xs">
                        {a.faculty || <span className="text-neutral-400 italic">Non renseignée</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge variant={accountStatus(a.is_active)} />
                      </td>
                      <td className="px-5 py-3.5 text-neutral-500 text-xs">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                            a.is_active
                              ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                              : "text-green-700 bg-green-50 hover:bg-green-100"
                          }`}
                          onClick={() => toggleUser(a)}
                          title={a.is_active ? "Désactiver le compte" : "Activer le compte"}
                        >
                          {a.is_active ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors"
                          onClick={() => handleDeleteUser(a)}
                          title="Supprimer (soft-delete)"
                        >
                          <IconTrash size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ──────────────── TAB: PROJECTS ──────────────── */}
        {activeTab === "projects" && (
          <Card padded={false}>
            <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold font-display text-neutral-800 text-lg">
                  Projets PFE ({projects.length})
                </h2>
                <p className="text-xs text-neutral-500">
                  Vue d'ensemble de tous les projets d'études et des dépôts de rapports.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IconDownload size={14} />}
                  onClick={exportProjectsCSV}
                  title="Exporter les projets au format CSV"
                >
                  Exporter CSV
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="text-left text-xs text-neutral-400 bg-neutral-50 border-b border-neutral-200">
                    <th className="font-medium px-5 py-3">Titre du Projet</th>
                    <th className="font-medium px-5 py-3">Équipe Étudiante</th>
                    <th className="font-medium px-5 py-3">Encadrant Académique</th>
                    <th className="font-medium px-5 py-3">Encadrant Entreprise</th>
                    <th className="font-medium px-5 py-3">Double Validation & Livrables</th>
                    <th className="font-medium px-5 py-3">Date</th>
                    <th className="font-medium px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-neutral-400 font-body">
                        {isLoading ? "Chargement des projets..." : "Aucun projet trouvé."}
                      </td>
                    </tr>
                  )}
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-neutral-800 max-w-xs truncate">
                        {p.title}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-medium text-neutral-800">{p.student_email || "Non assigné"}</p>
                          {p.co_student_email ? (
                            <span className="inline-block text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                              👥 Binôme: {p.co_student_email}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">Solo (Individuel)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {p.academic_encadrer_email ? (
                          <span className="text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                            🏛️ {p.academic_encadrer_email}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {p.enterprise_encadrer_email ? (
                          <span className="text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded-md">
                            🏢 {p.enterprise_encadrer_email}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-neutral-700 font-medium">
                        <div className="space-y-1">
                          <div>
                            {p.report_count > 0 ? (
                              <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded font-mono text-[11px]">
                                {p.report_count} livrable(s) (v{p.latest_version})
                              </span>
                            ) : (
                              <span className="text-neutral-400 text-[11px]">0 livrable</span>
                            )}
                          </div>
                          {p.workflow_status && (
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              p.workflow_status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                              p.workflow_status === "CHANGES_REQUESTED" ? "bg-amber-100 text-amber-800" :
                              "bg-blue-100 text-blue-800"
                            }`}>
                              {p.workflow_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-500 text-xs">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => { setSelectedProject(p); setAssignNotice("") }}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
                        >
                          Gérer / Assigner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ──────────────── MODAL: DÉTAILS D'UN PROJET ──────────────── */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <IconFileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-neutral-900">
                    Détails du Projet PFE
                  </h3>
                  <p className="text-xs text-neutral-400">ID: {selectedProject.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-neutral-400 hover:text-neutral-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm font-body max-h-[75vh] overflow-y-auto pr-1">
              {assignNotice && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                  assignNotice.includes("succès") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {assignNotice}
                </div>
              )}

              <div>
                <p className="text-xs text-neutral-400 font-semibold mb-1 uppercase tracking-wider">
                  Titre du Projet
                </p>
                <p className="text-neutral-900 font-medium bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  {selectedProject.title}
                </p>
              </div>

              {/* Équipe Étudiante & Binôme */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👥</span> Équipe Étudiante (Binôme)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-400 font-semibold">Porteur :</span>
                    <p className="font-semibold text-neutral-800">{selectedProject.student_email || "Non assigné"}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 font-semibold">Binôme Partenaire :</span>
                    <p className="font-semibold text-neutral-800">{selectedProject.co_student_email || "Aucun binôme"}</p>
                  </div>
                </div>

                {/* Form to attach binome */}
                <div className="pt-2 border-t border-neutral-200 flex items-center gap-2">
                  <input
                    type="email"
                    value={assignBinomeEmail}
                    onChange={(e) => setAssignBinomeEmail(e.target.value)}
                    placeholder="Email de l'étudiant binôme à rattacher..."
                    className="flex-1 text-xs border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                  <Button
                    size="sm"
                    disabled={isAssigningBinome || !assignBinomeEmail.trim()}
                    onClick={handleAssignBinome}
                  >
                    {isAssigningBinome ? "..." : "Rattacher Binôme"}
                  </Button>
                </div>
              </div>

              {/* Encadrants (Académique & Entreprise) */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎓</span> Encadrement & Supervision
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-400 font-semibold">🏛️ Académique :</span>
                    <p className="font-semibold text-neutral-800">{selectedProject.academic_encadrer_email || "Non assigné"}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 font-semibold">🏢 Entreprise :</span>
                    <p className="font-semibold text-neutral-800">{selectedProject.enterprise_encadrer_email || "Non assigné"}</p>
                  </div>
                </div>

                {/* Form to assign supervisor */}
                <div className="pt-2 border-t border-neutral-200 flex items-center gap-2">
                  <select
                    value={assignSupervisorRole}
                    onChange={(e) => setAssignSupervisorRole(e.target.value)}
                    className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white font-medium"
                  >
                    <option value="ACADEMIC">Académique</option>
                    <option value="ENTERPRISE">Entreprise</option>
                  </select>
                  <input
                    type="email"
                    value={assignSupervisorEmail}
                    onChange={(e) => setAssignSupervisorEmail(e.target.value)}
                    placeholder="Email de l'encadreur..."
                    className="flex-1 text-xs border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                  <Button
                    size="sm"
                    disabled={isAssigningSupervisor || !assignSupervisorEmail.trim()}
                    onClick={handleAssignSupervisor}
                  >
                    {isAssigningSupervisor ? "..." : "Assigner"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  <p className="text-xs text-neutral-400 font-semibold mb-0.5">Livrables & Versions</p>
                  <p className="text-xs font-medium text-neutral-800">
                    {selectedProject.report_count} version(s) déposée(s)
                  </p>
                </div>

                <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  <p className="text-xs text-neutral-400 font-semibold mb-0.5">Double Validation</p>
                  <p className="text-xs font-bold text-primary-700">
                    {selectedProject.workflow_status || "En attente"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-neutral-500">Statut actuel :</span>
                <StatusBadge variant={projectStatus(selectedProject)} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedProject(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── MODAL: CRÉATION D'UTILISATEUR ──────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-bold font-display text-neutral-900">
                  Créer un compte utilisateur
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  L'utilisateur recevra un compte directement configuré par l'administration.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-body">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4 font-body text-sm">
              {/* Role selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Rôle de l'utilisateur
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ENCADRER", "STUDENT", "ADMIN"] as UserRole[]).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setNewUser({ ...newUser, role: r })}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                        newUser.role === r
                          ? "border-primary-600 bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-600"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {roleLabel(r)}
                    </button>
                  ))}
                </div>
              </div>

              {/* First name & Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="ex. Mohamed"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="ex. Ben Salah"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="nom@universite.tn"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Mot de passe temporaire
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 6 caractères"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Faculty */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Faculté / Établissement (facultatif)
                </label>
                <input
                  type="text"
                  value={newUser.faculty}
                  onChange={(e) => setNewUser({ ...newUser, faculty: e.target.value })}
                  placeholder="ex. FST, ENIT, ISG..."
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Active status checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeAccountCheckbox"
                  checked={newUser.is_active}
                  onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="activeAccountCheckbox" className="text-xs text-neutral-700">
                  Activer immédiatement le compte (sans vérification email obligatoire)
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Création en cours..." : "Créer le compte"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
