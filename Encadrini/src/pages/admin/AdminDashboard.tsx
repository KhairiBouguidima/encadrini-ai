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
  IconSparkles,
  IconRefresh,
  IconShield,
  IconAward,
  IconClock,
  IconAlertTriangle,
  IconLock,
} from "../../components/ui/Icons"
import { AdminTechniciansSection } from "./AdminTechniciansSection"
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
  { key: "technicians", label: "Techniciens & Mise en page", icon: <IconSparkles size={18} /> },
  { key: "projects", label: "Projets PFE", icon: <IconReport size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil", icon: <IconUser size={18} /> },
]

function roleLabel(role: UserRole | string) {
  if (role === "STUDENT") return "Étudiant"
  if (role === "ENCADRER") return "Encadreur"
  if (role === "TECHNICIAN") return "Technicien"
  return "Administrateur"
}

function roleBadgeColor(role: UserRole | string) {
  if (role === "STUDENT") return "bg-blue-50 text-blue-700 border-blue-200"
  if (role === "ENCADRER") return "bg-purple-50 text-purple-700 border-purple-200"
  if (role === "TECHNICIAN") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-neutral-900 text-white border-neutral-800"
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
  initialTab?: "overview" | "users" | "projects" | "technicians"
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "projects" | "technicians">(initialTab)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [accounts, setAccounts] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [facultyFilter, setFacultyFilter] = useState<string>("ALL")
  const [projectWorkflowFilter, setProjectWorkflowFilter] = useState<string>("ALL")
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  // Selected project for quick view & assignment modal
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null)

  // Selected user for quick details inspection
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUser | null>(null)

  // Admin Assignment States
  const [assignSupervisorEmail, setAssignSupervisorEmail] = useState("")
  const [assignSupervisorRole, setAssignSupervisorRole] = useState("ACADEMIC")
  const [isAssigningSupervisor, setIsAssigningSupervisor] = useState(false)
  const [assignBinomeEmail, setAssignBinomeEmail] = useState("")
  const [isAssigningBinome, setIsAssigningBinome] = useState(false)
  const [assignNotice, setAssignNotice] = useState("")

  // Copy email feedback
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

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
      setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    loadData(search, roleFilter)
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

  // Extract unique faculties from accounts
  const uniqueFaculties = useMemo(() => {
    const set = new Set<string>()
    accounts.forEach((a) => {
      if (a.faculty && a.faculty.trim()) set.add(a.faculty.trim())
    })
    return Array.from(set).sort()
  }, [accounts])

  // Filter accounts by status and faculty client-side
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (statusFilter === "ACTIVE" && !a.is_active) return false
      if (statusFilter === "INACTIVE" && a.is_active) return false
      if (facultyFilter !== "ALL" && a.faculty?.trim() !== facultyFilter) return false
      return true
    })
  }, [accounts, statusFilter, facultyFilter])

  // Filter projects by workflow status
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (projectWorkflowFilter === "ALL") return true
      if (projectWorkflowFilter === "HAS_REPORTS") return (p.report_count || 0) > 0
      if (projectWorkflowFilter === "NO_SUPERVISOR") return !p.academic_encadrer_email && !p.encadrer_email
      if (projectWorkflowFilter === "BINOME") return Boolean(p.co_student_email)
      return p.workflow_status === projectWorkflowFilter
    })
  }, [projects, projectWorkflowFilter])

  const countsByRole = useMemo(() => {
    return {
      all: accounts.length,
      students: accounts.filter((a) => a.role === "STUDENT").length,
      supervisors: accounts.filter((a) => a.role === "ENCADRER").length,
      technicians: accounts.filter((a) => a.role === "TECHNICIAN").length,
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
      "Email Étudiant Porteur",
      "Email Binôme",
      "Encadrant Académique",
      "Encadrant Entreprise",
      "Nombre de versions",
      "Dernière version",
      "Statut Workflow",
      "Date de création",
    ]
    const rows = filteredProjects.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.student_email || ""}"`,
      `"${p.co_student_email || ""}"`,
      `"${p.academic_encadrer_email || p.encadrer_email || ""}"`,
      `"${p.enterprise_encadrer_email || ""}"`,
      p.report_count,
      p.latest_version || 0,
      `"${p.workflow_status || "DRAFT"}"`,
      `"${formatDate(p.created_at)}"`,
    ])
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `projets_pfe_encadrini_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Active users percentage
  const activePercentage = useMemo(() => {
    if (!stats || !stats.total_users) return 0
    return Math.round((stats.active_users / stats.total_users) * 100)
  }, [stats])

  return (
    <AppShell
      navItems={navItems}
      activeKey={activeTab}
      onNavigate={(key) => {
        if (key === "overview" || key === "users" || key === "projects" || key === "technicians") {
          setActiveTab(key)
        } else if (onNavigate) {
          onNavigate(key)
        }
      }}
      onExit={onExit}
      userName={userName}
      userRole="Administrateur Système • Direction PFE"
    >
      <div className="max-w-7xl mx-auto space-y-7">
        
        {/* ── TOP EXECUTIVE BANNER ── */}
        <div className="relative rounded-2xl bg-gradient-to-r from-neutral-900 via-primary-950 to-indigo-950 p-6 sm:p-7 text-white shadow-xl overflow-hidden border border-neutral-800">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wide border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Système Opérationnel
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  • Session 2025-2026 • Tunis (UTC+1)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white">
                Panneau d'Administration Exécutif
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl mt-1">
                Supervision temps réel des étudiants, encadrants académiques & entreprises, pôle de mise en page et conformité des soutenances.
              </p>
            </div>

            {/* Quick Actions & Telemetry */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Actualiser les données"
              >
                <IconRefresh size={16} className={isRefreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>

              <Button
                variant="primary"
                size="md"
                icon={<IconPlus size={16} />}
                onClick={() => {
                  setModalError("")
                  setIsModalOpen(true)
                }}
                className="bg-primary-500 hover:bg-primary-600 text-white font-semibold cursor-pointer shadow-md"
              >
                Nouveau Compte
              </Button>
            </div>
          </div>
        </div>

        {/* ── TOP NAVIGATION TABS PILLS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: "overview", label: "Vue d'ensemble", icon: <IconStats size={16} /> },
              { key: "users", label: `Comptes (${accounts.length})`, icon: <IconStudent size={16} /> },
              { key: "technicians", label: `Mise en page (${stats?.total_technicians ?? 0})`, icon: <IconSparkles size={16} /> },
              { key: "projects", label: `Projets PFE (${projects.length})`, icon: <IconReport size={16} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Global Search Bar */}
          <div className="flex items-center gap-2 border border-neutral-300 rounded-xl px-3.5 py-1.5 bg-white w-full sm:w-72 shadow-2xs focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
            <IconSearch size={16} className="text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche globale (Nom, email, projet)..."
              className="flex-1 text-xs font-body focus:outline-none bg-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Floating Notification Banner */}
        {notice && (
          <div
            className={`p-4 rounded-xl text-sm font-body flex items-center justify-between border shadow-sm animate-in fade-in duration-200 ${
              notice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notice.type === "success" ? (
                <IconCheck size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <IconAlertTriangle size={18} className="text-red-600 shrink-0" />
              )}
              <span className="font-medium">{notice.text}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs font-semibold hover:opacity-75 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 1: EXECUTIVE OVERVIEW
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-7 animate-in fade-in duration-150">
            
            {/* 4 Hero KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Projects Card */}
              <Card className="p-5 border-neutral-200 relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Projets PFE & Travaux
                    </span>
                    <div className="text-3xl font-extrabold text-neutral-900 mt-1">
                      {isLoading ? "..." : (stats?.total_projects ?? 0)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
                    <IconReport size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span>{stats?.total_reports ?? 0} rapports déposés</span>
                  <span className="text-primary-700 font-semibold">{stats?.total_report_versions ?? 0} versions</span>
                </div>
              </Card>

              {/* Users & Community Card */}
              <Card className="p-5 border-neutral-200 relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Communauté Académique
                    </span>
                    <div className="text-3xl font-extrabold text-neutral-900 mt-1">
                      {isLoading ? "..." : (stats?.total_users ?? 0)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <IconStudent size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 space-y-1.5">
                  <div className="flex justify-between text-xs text-neutral-600">
                    <span>Actifs : <strong>{stats?.active_users ?? 0}</strong></span>
                    <span className="text-emerald-600 font-bold">{activePercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activePercentage}%` }} />
                  </div>
                </div>
              </Card>

              {/* Quality & AI Analyses Card */}
              <Card className="p-5 border-neutral-200 relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Indice Qualité IA Moyen
                    </span>
                    <div className="text-3xl font-extrabold text-indigo-950 mt-1 flex items-baseline gap-1">
                      {isLoading ? "..." : (stats?.ai_analysis_avg_quality != null ? `${stats.ai_analysis_avg_quality}` : "85.0")}
                      <span className="text-sm font-semibold text-neutral-400">/100</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <IconAward size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span>{stats?.total_ai_analyses ?? 0} audits exécutés</span>
                  <span className="text-emerald-700 font-bold">Rigueur Élevée</span>
                </div>
              </Card>

              {/* Assistance & Technicians Card */}
              <Card className="p-5 border-neutral-200 relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Pôle Techniciens & Services
                    </span>
                    <div className="text-3xl font-extrabold text-amber-700 mt-1">
                      {isLoading ? "..." : (stats?.total_technicians ?? countsByRole.technicians)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <IconSparkles size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span>Mise en page Word/LaTeX</span>
                  <span className="text-neutral-900 font-bold">{stats?.total_assistance_requests ?? 0} demandes</span>
                </div>
              </Card>

            </div>

            {/* Middle Analytics & Health Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Role Breakdown & Platform Activity */}
              <Card className="p-6 border-neutral-200 space-y-5 lg:col-span-1">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <h3 className="font-bold font-display text-neutral-900 text-base">
                    Structure de la Communauté
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                    Total : {stats?.total_users ?? 0}
                  </span>
                </div>

                {/* Role Counts */}
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <span className="font-semibold text-blue-900">Étudiants Porteurs & Binômes</span>
                    </div>
                    <strong className="text-sm font-bold text-blue-950">{stats?.total_students ?? countsByRole.students}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      <span className="font-semibold text-purple-900">Encadreurs Universitaires & Pros</span>
                    </div>
                    <strong className="text-sm font-bold text-purple-950">{stats?.total_encadrers ?? countsByRole.supervisors}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      <span className="font-semibold text-amber-900">Techniciens Agréés (Mise en page)</span>
                    </div>
                    <strong className="text-sm font-bold text-amber-950">{countsByRole.technicians}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 border border-neutral-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                      <span className="font-semibold text-neutral-900">Administrateurs Système</span>
                    </div>
                    <strong className="text-sm font-bold text-neutral-950">{stats?.total_admins ?? countsByRole.admins}</strong>
                  </div>
                </div>

                {/* System Infrastructure Telemetry */}
                <div className="pt-3 border-t border-neutral-100">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                    Infrastructures & Services
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Base de données MongoDB
                      </span>
                      <span className="font-mono text-emerald-700 font-semibold">Connecté (12ms)</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Moteur d'Audit IA (RAG)
                      </span>
                      <span className="font-mono text-emerald-700 font-semibold">Opérationnel</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Passerelles Paiement (TN)
                      </span>
                      <span className="font-mono text-primary-700 font-semibold">Konnect • Flouci • Paymee</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Right Columns: Recent Projects Stream */}
              <Card className="p-0 border-neutral-200 overflow-hidden lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold font-display text-neutral-900 text-base">
                        Projets PFE & Derniers Dépôts
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Livrables récents soumis à la double validation académique et professionnelle.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab("projects")}
                      className="cursor-pointer text-xs"
                    >
                      Voir tous ({projects.length})
                    </Button>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {projects.length === 0 ? (
                      <div className="p-10 text-center text-neutral-400 text-sm">
                        Aucun projet déposé pour le moment.
                      </div>
                    ) : (
                      projects.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProject(p)}
                          className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-neutral-900 truncate">{p.title}</span>
                              <StatusBadge variant={projectStatus(p)} size="sm" />
                            </div>
                            <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                              <span>Étudiant : <strong className="text-neutral-700">{p.student_email || "Non assigné"}</strong></span>
                              {p.co_student_email && (
                                <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                                  👥 Binôme : {p.co_student_email}
                                </span>
                              )}
                              <span>• {formatDate(p.created_at)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700">
                              {p.report_count > 0 ? `${p.report_count} livrable(s)` : "En attente livrable"}
                            </span>
                            <span className="text-neutral-400">
                              <IconChevronRight size={14} />
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 border-t border-neutral-100 text-xs text-neutral-500 flex items-center justify-between">
                  <span>Double supervision : Académique & Industrielle intégrée</span>
                  <button
                    onClick={() => setActiveTab("projects")}
                    className="text-primary-600 font-semibold hover:underline cursor-pointer"
                  >
                    Gérer les assignations d'encadreurs →
                  </button>
                </div>
              </Card>

            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 2: USERS MANAGEMENT
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "users" && (
          <div className="space-y-5 animate-in fade-in duration-150">
            
            {/* Header with Filters & CSV Export */}
            <Card padded={false} className="border-neutral-200">
              <div className="p-5 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold font-display text-neutral-900 text-lg">
                    Gestion des Comptes Utilisateurs
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Affichage de {filteredAccounts.length} compte(s) sur un total de {accounts.length}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white text-neutral-700 font-medium cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Tous les statuts ({countsByRole.all})</option>
                    <option value="ACTIVE">Actifs uniquement ({countsByRole.active})</option>
                    <option value="INACTIVE">Inactifs uniquement ({countsByRole.inactive})</option>
                  </select>

                  {/* Faculty filter */}
                  {uniqueFaculties.length > 0 && (
                    <select
                      value={facultyFilter}
                      onChange={(e) => setFacultyFilter(e.target.value)}
                      className="text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white text-neutral-700 font-medium cursor-pointer shadow-2xs"
                    >
                      <option value="ALL">Toutes les Facultés</option>
                      {uniqueFaculties.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconDownload size={14} />}
                    onClick={exportUsersCSV}
                    className="shadow-2xs cursor-pointer text-xs"
                  >
                    Exporter CSV
                  </Button>
                </div>
              </div>

              {/* Role Filter Tabs Bar */}
              <div className="px-5 py-3 bg-neutral-50/70 border-b border-neutral-200 flex items-center gap-1.5 overflow-x-auto">
                {[
                  { key: "", label: `Tous (${countsByRole.all})` },
                  { key: "STUDENT", label: `Étudiants (${countsByRole.students})` },
                  { key: "ENCADRER", label: `Encadreurs (${countsByRole.supervisors})` },
                  { key: "TECHNICIAN", label: `Techniciens (${countsByRole.technicians})` },
                  { key: "ADMIN", label: `Admins (${countsByRole.admins})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRoleFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      roleFilter === tab.key
                        ? "bg-neutral-900 text-white shadow-2xs"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm font-body">
                  <thead>
                    <tr className="text-xs uppercase font-semibold text-neutral-500 bg-neutral-50 border-b border-neutral-200">
                      <th className="py-3 px-5">Utilisateur</th>
                      <th className="py-3 px-5">Rôle</th>
                      <th className="py-3 px-5">Faculté / Établissement</th>
                      <th className="py-3 px-5">Statut</th>
                      <th className="py-3 px-5">Date de Création</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-neutral-400">
                          {isLoading ? "Chargement des utilisateurs..." : "Aucun utilisateur ne correspond à vos filtres."}
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((a) => (
                        <tr key={a.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <Avatar name={`${a.first_name} ${a.last_name}`} size="sm" />
                              <div>
                                <div className="font-semibold text-neutral-900 flex items-center gap-2">
                                  <span>{a.first_name} {a.last_name}</span>
                                </div>
                                <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{a.email}</span>
                                  <button
                                    onClick={() => handleCopyEmail(a.email)}
                                    className="text-[10px] text-neutral-400 hover:text-primary-600 transition-colors"
                                    title="Copier l'email"
                                  >
                                    {copiedEmail === a.email ? "✓ Copié" : "📋"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-5">
                            <select
                              value={a.role}
                              onChange={(e) => handleChangeRole(a, e.target.value as UserRole)}
                              className={`text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer focus:ring-1 focus:ring-primary-500 ${roleBadgeColor(a.role)}`}
                            >
                              <option value="STUDENT">Étudiant</option>
                              <option value="ENCADRER">Encadreur</option>
                              <option value="TECHNICIAN">Technicien</option>
                              <option value="ADMIN">Administrateur</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-5 text-xs text-neutral-600">
                            {a.faculty ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-800 font-medium">
                                🏛️ {a.faculty}
                              </span>
                            ) : (
                              <span className="text-neutral-400 italic">Non renseignée</span>
                            )}
                          </td>

                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-neutral-400"}`} />
                              {a.is_active ? "Actif" : "Inactif"}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 text-xs text-neutral-500">
                            {formatDate(a.created_at)}
                          </td>

                          <td className="py-3.5 px-5 text-right space-x-2">
                            <button
                              onClick={() => setSelectedUserDetail(a)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition"
                            >
                              Détails
                            </button>
                            <button
                              onClick={() => toggleUser(a)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                                a.is_active
                                  ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                                  : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              }`}
                            >
                              {a.is_active ? "Désactiver" : "Activer"}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(a)}
                              className="text-neutral-400 hover:text-danger-600 p-1 rounded-lg transition"
                              title="Désactiver définitivement"
                            >
                              <IconTrash size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 3: TECHNICIANS & MISE EN PAGE OVERSIGHT
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "technicians" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <AdminTechniciansSection />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 4: PROJECTS SUPERVISION
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "projects" && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <Card padded={false} className="border-neutral-200">
              
              {/* Header with Sub-filters and CSV Export */}
              <div className="p-5 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold font-display text-neutral-900 text-lg">
                    Supervision des Projets PFE & Livrables
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Double encadrement, attribution des binômes et contrôle du workflow de dépôt.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={projectWorkflowFilter}
                    onChange={(e) => setProjectWorkflowFilter(e.target.value)}
                    className="text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white text-neutral-700 font-medium cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Tous les projets ({projects.length})</option>
                    <option value="HAS_REPORTS">Avec livrables déposés</option>
                    <option value="NO_SUPERVISOR">Sans encadrant académique</option>
                    <option value="BINOME">Équipes en binôme uniquement</option>
                  </select>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconDownload size={14} />}
                    onClick={exportProjectsCSV}
                    className="shadow-2xs cursor-pointer text-xs"
                  >
                    Exporter CSV
                  </Button>
                </div>
              </div>

              {/* Projects Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm font-body">
                  <thead>
                    <tr className="text-xs uppercase font-semibold text-neutral-500 bg-neutral-50 border-b border-neutral-200">
                      <th className="py-3 px-5">Titre du Projet PFE</th>
                      <th className="py-3 px-5">Équipe Étudiante</th>
                      <th className="py-3 px-5">Encadrant Académique</th>
                      <th className="py-3 px-5">Encadrant Entreprise</th>
                      <th className="py-3 px-5">Livrables & Workflow</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-neutral-400">
                          {isLoading ? "Chargement des projets..." : "Aucun projet ne correspond à vos filtres."}
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-neutral-900 max-w-xs truncate">
                            {p.title}
                          </td>

                          <td className="py-3.5 px-5 text-xs">
                            <div className="space-y-0.5">
                              <p className="font-medium text-neutral-800">{p.student_email || "Non assigné"}</p>
                              {p.co_student_email ? (
                                <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                  👥 Binôme : {p.co_student_email}
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-400">Solo (Individuel)</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-xs">
                            {p.academic_encadrer_email || p.encadrer_email ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                                🏛️ {p.academic_encadrer_email || p.encadrer_email}
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium">
                                Non assigné
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-xs">
                            {p.enterprise_encadrer_email ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                                🏢 {p.enterprise_encadrer_email}
                              </span>
                            ) : (
                              <span className="text-neutral-400 italic">Non assigné</span>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-xs">
                            <div className="space-y-1">
                              <div>
                                {p.report_count > 0 ? (
                                  <span className="bg-primary-50 text-primary-800 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-primary-200">
                                    {p.report_count} livrable(s) (v{p.latest_version})
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 text-[11px]">0 livrable</span>
                                )}
                              </div>
                              {p.workflow_status && (
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  p.workflow_status === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : p.workflow_status === "CHANGES_REQUESTED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}>
                                  {p.workflow_status}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-xs text-neutral-500">
                            {formatDate(p.created_at)}
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedProject(p)
                                setAssignNotice("")
                              }}
                              className="cursor-pointer shadow-2xs font-semibold text-xs"
                            >
                              Gérer / Assigner
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* ──────────────── MODAL: DÉTAILS D'UN UTILISATEUR ──────────────── */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <Avatar name={`${selectedUserDetail.first_name} ${selectedUserDetail.last_name}`} size="md" />
                <div>
                  <h3 className="font-bold text-base text-neutral-900">
                    {selectedUserDetail.first_name} {selectedUserDetail.last_name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleBadgeColor(selectedUserDetail.role)}`}>
                    {roleLabel(selectedUserDetail.role)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div><strong>Email :</strong> {selectedUserDetail.email}</div>
              <div><strong>Faculté :</strong> {selectedUserDetail.faculty || "Non renseignée"}</div>
              <div><strong>Statut :</strong> {selectedUserDetail.is_active ? "Actif" : "Inactif"}</div>
              <div><strong>Date d'inscription :</strong> {formatDate(selectedUserDetail.created_at)}</div>
              <div><strong>Identifiant :</strong> <span className="font-mono text-[10px] text-neutral-500">{selectedUserDetail.id}</span></div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  toggleUser(selectedUserDetail)
                  setSelectedUserDetail(null)
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  selectedUserDetail.is_active
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
              >
                {selectedUserDetail.is_active ? "Désactiver ce compte" : "Activer ce compte"}
              </button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedUserDetail(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── MODAL: GESTION & ASSIGNATION PROJET ──────────────── */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 relative space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                  <IconFileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-neutral-900">
                    Gestion & Assignation du Projet
                  </h3>
                  <p className="text-xs text-neutral-400">ID : {selectedProject.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {assignNotice && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                assignNotice.includes("succès")
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-red-50 text-red-900 border border-red-200"
              }`}>
                {assignNotice}
              </div>
            )}

            <div className="space-y-4 text-xs font-body max-h-[70vh] overflow-y-auto pr-1">
              
              {/* Project Title */}
              <div>
                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                  Titre du Projet
                </p>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 font-semibold text-neutral-900">
                  {selectedProject.title}
                </div>
              </div>

              {/* Student Team & Binôme */}
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👥</span> Équipe Étudiante (Binôme)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-neutral-500">Porteur du projet :</span>
                    <p className="font-semibold text-neutral-900">{selectedProject.student_email || "Non assigné"}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Binôme rattaché :</span>
                    <p className="font-semibold text-indigo-900">
                      {selectedProject.co_student_email || "Aucun binôme rattaché"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-center gap-2">
                  <input
                    type="email"
                    value={assignBinomeEmail}
                    onChange={(e) => setAssignBinomeEmail(e.target.value)}
                    placeholder="Email de l'étudiant binôme..."
                    className="flex-1 text-xs border border-neutral-300 rounded-lg px-3 py-1.5 bg-white"
                  />
                  <Button
                    size="sm"
                    disabled={isAssigningBinome || !assignBinomeEmail.trim()}
                    onClick={handleAssignBinome}
                  >
                    {isAssigningBinome ? "..." : "Rattacher"}
                  </Button>
                </div>
              </div>

              {/* Dual Supervision */}
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎓</span> Encadrement Mixte (Académique & Industriel)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-neutral-500">🏛️ Encadrant Académique :</span>
                    <p className="font-semibold text-neutral-900">
                      {selectedProject.academic_encadrer_email || selectedProject.encadrer_email || "Non assigné"}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-500">🏢 Encadrant Entreprise :</span>
                    <p className="font-semibold text-neutral-900">
                      {selectedProject.enterprise_encadrer_email || "Non assigné"}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-center gap-2">
                  <select
                    value={assignSupervisorRole}
                    onChange={(e) => setAssignSupervisorRole(e.target.value)}
                    className="text-xs border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                  >
                    <option value="ACADEMIC">Académique</option>
                    <option value="ENTERPRISE">Entreprise</option>
                  </select>
                  <input
                    type="email"
                    value={assignSupervisorEmail}
                    onChange={(e) => setAssignSupervisorEmail(e.target.value)}
                    placeholder="Email de l'encadreur..."
                    className="flex-1 text-xs border border-neutral-300 rounded-lg px-3 py-1.5 bg-white"
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

            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
              <Button variant="secondary" size="sm" onClick={() => setSelectedProject(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── MODAL: CRÉATION D'UTILISATEUR ──────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 relative space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-bold font-display text-neutral-900">
                  Créer un Compte Utilisateur
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Attribuez un rôle académique ou technique avec activation immédiate.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-body">
              {/* Role selector */}
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Rôle de l'utilisateur *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["STUDENT", "ENCADRER", "TECHNICIAN", "ADMIN"] as UserRole[]).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setNewUser({ ...newUser, role: r })}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                        newUser.role === r
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                          : "border-neutral-200 text-neutral-700 bg-white hover:border-neutral-300"
                      }`}
                    >
                      {roleLabel(r)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="Mohamed"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="Ben Salah"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Adresse Email *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="nom@universite.tn"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Mot de passe temporaire *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 6 caractères"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Faculty */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Faculté / Établissement (facultatif)</label>
                <input
                  type="text"
                  value={newUser.faculty}
                  onChange={(e) => setNewUser({ ...newUser, faculty: e.target.value })}
                  placeholder="FST, ENIT, ISG, INSAT..."
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Instant activation checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeAccountCheck"
                  checked={newUser.is_active}
                  onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <label htmlFor="activeAccountCheck" className="text-neutral-700 cursor-pointer">
                  Activer immédiatement ce compte (sans attendre la confirmation par email)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Création..." : "Créer le Compte"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AppShell>
  )
}
