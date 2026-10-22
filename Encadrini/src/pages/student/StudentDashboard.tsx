import { useEffect, useMemo, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card, Avatar, Input } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { 
  IconReport, IconSparkles, IconChevronRight, 
  IconBell, IconUser, IconCalendar, IconDownload, 
  IconFileText, IconEdit, IconCheck, IconStats, IconPlus, IconUpload, IconAward,
  IconSupervisor, IconTrash, IconShield
} from "../../components/ui/Icons"
import {
  api,
  type Project,
  type ReportHistory,
  type User,
  type PendingSupervisorInvitation,
  type DualValidationVersionStatus,
  type ProjectTask,
  type SupervisorRole,
  type InvitationItem
} from "../../lib/api"
import { useToast } from "../../components/ui/Toast"
import { MeetingLogsView } from "../../components/meetings/MeetingLogsView"
import { CertificateView } from "../../components/certificates/CertificateView"
import { STUDENT_NAV_ITEMS } from "../../lib/navItems"

interface Milestone {
  id: string
  title: string
  subtitle: string
  completed: boolean
  current?: boolean
}

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "1", title: "Cadrage & Cahier des charges", subtitle: "Définition du sujet et objectifs", completed: true },
  { id: "2", title: "État de l'art & Étude bibliographique", subtitle: "Revue de littérature et comparatifs", completed: false, current: true },
  { id: "3", title: "Conception & Architecture", subtitle: "Diagrammes UML, choix technologiques", completed: false },
  { id: "4", title: "Développement & Expérimentations", subtitle: "Implémentation et tests de performance", completed: false },
  { id: "5", title: "Rédaction finale du manuscrit", subtitle: "Finalisation du rapport et annexes", completed: false },
  { id: "6", title: "Préparation de la soutenance", subtitle: "Slides de présentation et répétition", completed: false },
]

function statusToBadge(status?: string): BadgeVariant {
  if (status === "COMPLETED") return "analysed"
  if (status === "PROCESSING") return "reviewing"
  if (status === "FAILED") return "rejected"
  return "pending"
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Ko"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  const now = new Date().getTime()
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  return diffDays
}

export function StudentDashboard({
  onOpenVersion: _onOpenVersion,
  onOpenWorkshop,
  onNavigate,
  onExit,
  user,
}: {
  onOpenVersion: (reportId: string, versionId: string) => void
  onOpenWorkshop: (reportId: string, versionId: string) => void
  onNavigate?: (key: string) => void
  onExit: () => void
  user?: User | null
}) {
  const { toast, confirm } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<ReportHistory[]>([])
  const [invitations, setInvitations] = useState<InvitationItem[]>([])
  const [pendingBinomeInvs, setPendingBinomeInvs] = useState<PendingSupervisorInvitation[]>([])
  const [dualValidation, setDualValidation] = useState<DualValidationVersionStatus | null>(null)
  const [dashboardTab, setDashboardTab] = useState<"overview" | "meetings" | "certificate">("overview")
  const [notice, setNotice] = useState("")
  const [_isLoading, setIsLoading] = useState(false)

  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    const saved = localStorage.getItem("encadrini_milestones")
    return saved ? JSON.parse(saved) : DEFAULT_MILESTONES
  })
  
  // Create Project State
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")
  const [newProjectDeadline, setNewProjectDeadline] = useState("")
  const [newProjectTags, setNewProjectTags] = useState("")

  // Edit Project Modal
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editProgress, setEditProgress] = useState(0)
  const [editStatus, setEditStatus] = useState("ACTIVE")
  const [editDeadline, setEditDeadline] = useState("")
  const [editTags, setEditTags] = useState("")
  const [isSavingProject, setIsSavingProject] = useState(false)

  // Binôme Modal
  const [isBinomeModalOpen, setIsBinomeModalOpen] = useState(false)
  const [binomeEmail, setBinomeEmail] = useState("")
  const [isInvitingBinome, setIsInvitingBinome] = useState(false)

  // Supervisor Modal
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false)
  const [supervisorEmail, setSupervisorEmail] = useState("")
  const [supervisorRoleToInvite, setSupervisorRoleToInvite] = useState<SupervisorRole>("ACADEMIC")
  const [isInvitingSupervisor, setIsInvitingSupervisor] = useState(false)

  // Task Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDesc, setTaskDesc] = useState("")
  const [taskAssignee, setTaskAssignee] = useState<string>("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [isSavingTask, setIsSavingTask] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Étudiant"

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    setNotice("")
    try {
      const [projectData, reportsData, invs, binomeInvs] = await Promise.all([
        api.getMyProject().catch(() => null),
        api.getReports().catch(() => []),
        api.getProjectInvitations().catch(() => []),
        api.getPendingBinomeInvitations().catch(() => []),
      ])
      setProject(projectData)
      setReports(reportsData)
      setInvitations(invs)
      setPendingBinomeInvs(binomeInvs)

      // If reports exist, fetch dual-validation for latest version
      if (reportsData.length > 0) {
        const rep = reportsData[0]
        const vNum = rep.current_version || (rep.versions.length > 0 ? rep.versions[rep.versions.length - 1].version_number : 1)
        try {
          const dv = await api.getVersionDualValidation(rep.id, vNum)
          setDualValidation(dv)
        } catch {
          setDualValidation(null)
        }
      } else {
        setDualValidation(null)
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de chargement.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  // Toggle milestone completion
  const toggleMilestone = (id: string) => {
    setMilestones((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
      localStorage.setItem("encadrini_milestones", JSON.stringify(next))
      return next
    })
  }

  // Open Edit Modal with current project data
  const openEditProject = () => {
    if (!project) return
    setEditTitle(project.title)
    setEditDesc(project.description)
    setEditProgress(project.progress || 0)
    setEditStatus(project.status || "ACTIVE")
    setEditDeadline(project.deadline ? project.deadline.split("T")[0] : "")
    setEditTags(project.tags ? project.tags.join(", ") : "")
    setIsEditProjectOpen(true)
  }

  // Save Project Changes
  const handleSaveProject = async () => {
    if (!project) return
    setIsSavingProject(true)
    try {
      const updated = await api.updateMyProject({
        title: editTitle.trim(),
        description: editDesc.trim(),
        progress: Number(editProgress),
        status: editStatus,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      setProject(updated)
      setIsEditProjectOpen(false)
      toast.success("Projet mis à jour avec succès.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // Create Project
  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return
    setIsCreatingProject(true)
    try {
      const tagsList = newProjectTags.split(",").map((t) => t.trim()).filter(Boolean)
      const p = await api.createProject(
        newProjectTitle.trim(), 
        newProjectDesc.trim(), 
        tagsList, 
        newProjectDeadline ? new Date(newProjectDeadline).toISOString() : undefined
      )
      setProject(p)
      toast.success("Projet créé avec succès ! Configurez votre équipe ci-dessous.")
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création du projet.")
    } finally {
      setIsCreatingProject(false)
    }
  }

  // Quick progress increment
  const adjustProgress = async (delta: number) => {
    if (!project) return
    const nextVal = Math.min(100, Math.max(0, (project.progress || 0) + delta))
    try {
      const updated = await api.updateMyProject({ progress: nextVal })
      setProject(updated)
    } catch (err) {
      console.error(err)
    }
  }

  // Binôme invite handler
  const handleInviteBinome = async () => {
    if (!binomeEmail.trim()) return
    setIsInvitingBinome(true)
    try {
      await api.inviteBinome(binomeEmail.trim())
      toast.success(`Invitation envoyée à ${binomeEmail.trim()} pour former un binôme.`)
      setBinomeEmail("")
      setIsBinomeModalOpen(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'invitation.")
    } finally {
      setIsInvitingBinome(false)
    }
  }

  // Binôme accept received invitation
  const handleAcceptBinomeReceived = async (invitationId: string) => {
    try {
      await api.acceptBinomeInvitation(invitationId)
      toast.success("Vous avez rejoint le projet en binôme !")
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de rejoindre le binôme.")
    }
  }

  // Binôme decline received invitation
  const handleDeclineBinomeReceived = async (invitationId: string) => {
    try {
      await api.declineBinomeInvitation(invitationId)
      toast.info("Invitation de binôme déclinée.")
      setPendingBinomeInvs((prev) => prev.filter((i) => i.invitation_id !== invitationId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.")
    }
  }

  // Remove Binôme partner
  const handleRemoveBinome = () => {
    confirm({
      title: "Dissocier le binôme ?",
      message: "Êtes-vous certain de vouloir dissocier le binôme pour ce projet PFE ? Le projet reviendra au mode individuel.",
      confirmText: "Confirmer la dissociation",
      variant: "danger",
      onConfirm: async () => {
        try {
          const updated = await api.removeBinome()
          setProject(updated)
          toast.success("Binôme dissocié avec succès.")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erreur lors de la dissociation.")
        }
      }
    })
  }

  // Supervisor invite handler
  const handleInviteSupervisor = async () => {
    if (!supervisorEmail.trim()) return
    setIsInvitingSupervisor(true)
    try {
      await api.inviteEncadrer(supervisorEmail.trim(), supervisorRoleToInvite)
      const roleTxt = supervisorRoleToInvite === "ACADEMIC" ? "académique" : "d'entreprise"
      toast.success(`Invitation envoyée à ${supervisorEmail.trim()} en tant qu'encadreur ${roleTxt}.`)
      setSupervisorEmail("")
      setIsSupervisorModalOpen(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'invitation.")
    } finally {
      setIsInvitingSupervisor(false)
    }
  }

  // Remove supervisor
  const handleRemoveSupervisor = (encId: string, roleName: string) => {
    confirm({
      title: `Retirer l'encadreur ${roleName} ?`,
      message: "Êtes-vous certain de vouloir retirer cet encadreur de votre projet PFE ?",
      confirmText: "Retirer",
      variant: "danger",
      onConfirm: async () => {
        try {
          const updated = await api.removeEncadrer(encId)
          setProject(updated)
          toast.success("Encadreur retiré avec succès.")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erreur.")
        }
      }
    })
  }

  // Task Create handler
  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return
    setIsSavingTask(true)
    try {
      await api.createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assigned_to: taskAssignee || undefined,
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
      })
      toast.success("Tâche partagée créée avec succès !")
      setTaskTitle("")
      setTaskDesc("")
      setTaskDueDate("")
      setIsTaskModalOpen(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création de la tâche.")
    } finally {
      setIsSavingTask(false)
    }
  }

  // Task Toggle
  const handleToggleTask = async (task: ProjectTask) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE"
    try {
      await api.updateTask(task.id, { status: nextStatus })
      await loadData()
    } catch (err) {
      toast.error("Impossible de modifier la tâche.")
    }
  }

  // Task Delete
  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId)
      toast.info("Tâche supprimée.")
      await loadData()
    } catch (err) {
      toast.error("Erreur lors de la suppression.")
    }
  }

  const totalVersionsCount = useMemo(() => {
    return reports.reduce((acc, r) => acc + (r.versions?.length || 0), 0)
  }, [reports])

  const daysLeft = useMemo(() => daysUntil(project?.deadline), [project?.deadline])

  const pendingBinomeInviteSent = useMemo(() => {
    return invitations.find((i) => i.invitation_type === "BINOME" && i.status === "PENDING")
  }, [invitations])

  return (
    <AppShell
      navItems={STUDENT_NAV_ITEMS}
      activeKey={dashboardTab === "overview" ? "dashboard" : dashboardTab}
      onNavigate={(key) => {
        if (key === "dashboard") {
          setDashboardTab("overview")
        } else if (key === "meetings") {
          setDashboardTab("meetings")
        } else if (key === "certificate") {
          setDashboardTab("certificate")
        } else if (key === "workshop" && reports.length > 0) {
          const first = reports[0]
          onOpenWorkshop(first.id, String(first.current_version || 1))
        } else if (onNavigate) {
          onNavigate(key)
        }
      }}
      onExit={onExit}
      userName={userName}
      userRole={project?.is_binome ? "Étudiant (Projet en Binôme)" : "Étudiant"}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {notice && (
          <div className="rounded-xl bg-primary-50/80 border border-primary-200 px-4 py-3 text-sm text-primary-800 font-body flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="text-primary-600 hover:text-primary-800 font-bold ml-4">✕</button>
          </div>
        )}

        {/* ── BANNER: INVITATION BINÔME REÇUE ── */}
        {pendingBinomeInvs.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-primary-50 border-2 border-indigo-200 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">👥</span>
              <div>
                <h3 className="text-sm font-bold font-display text-indigo-950">
                  Invitation de binôme reçue !
                </h3>
                <p className="text-xs text-indigo-700 font-body">
                  Un étudiant souhaite collaborer avec vous sur son projet de fin d'études.
                </p>
              </div>
            </div>
            {pendingBinomeInvs.map((inv) => (
              <div key={inv.invitation_id} className="bg-white p-3.5 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-neutral-900">{inv.student_name} vous invite à rejoindre :</p>
                  <p className="text-primary-700 font-semibold mt-0.5">« {inv.project_title} »</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleAcceptBinomeReceived(inv.invitation_id)}>
                    Accepter le binôme
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDeclineBinomeReceived(inv.invitation_id)}>
                    Décliner
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CREATE PROJECT IF NONE EXISTS ── */}
        {!project ? (
          <Card className="p-8 border-dashed border-2 border-neutral-300">
            <div className="max-w-xl mx-auto text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-2">
                <IconReport size={28} />
              </div>
              <h2 className="text-xl font-bold font-display text-neutral-900">Configurez votre projet PFE</h2>
              <p className="text-sm text-neutral-500 font-body">
                Pour commencer à déposer vos livrables, collaborer en binôme et être suivi par vos encadreurs, créez votre projet.
              </p>
              <div className="space-y-3.5 text-left pt-2">
                <Input
                  label="Titre du projet PFE"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Ex : Plateforme Cloud & IA pour l'analyse médicale"
                  required
                />
                <Input
                  label="Description / Problématique"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Objectif général, contexte académique et périmètre technique..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Technologies & Mots-clés (séparés par virgules)"
                    value={newProjectTags}
                    onChange={(e) => setNewProjectTags(e.target.value)}
                    placeholder="Python, React, FastApi, Docker..."
                  />
                  <Input
                    label="Date limite / Soutenance"
                    type="date"
                    value={newProjectDeadline}
                    onChange={(e) => setNewProjectDeadline(e.target.value)}
                  />
                </div>
                <Button
                  fullWidth
                  size="lg"
                  disabled={isCreatingProject || !newProjectTitle.trim()}
                  onClick={handleCreateProject}
                  className="mt-4"
                >
                  {isCreatingProject ? "Création en cours..." : "Créer mon projet PFE"}
                </Button>
              </div>
            </div>
          </Card>
        ) : dashboardTab === "meetings" ? (
          <MeetingLogsView
            project={project}
            currentUser={user ?? null}
            onBack={() => setDashboardTab("overview")}
          />
        ) : dashboardTab === "certificate" ? (
          <CertificateView
            project={project}
            currentUser={user ?? null}
            reports={reports}
            onOpenVerification={() => onNavigate?.("verify-certificate")}
          />
        ) : (
          <>
            {/* ── PROJECT HEADER CARD ── */}
            <Card className="overflow-hidden p-6 sm:p-7 relative border-neutral-200">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {project.academic_year || "2025-2026"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      project.is_binome ? "bg-indigo-100 text-indigo-800" : "bg-neutral-100 text-neutral-800"
                    }`}>
                      {project.is_binome ? "👥 Binôme (2 étudiants)" : "👤 Projet Individuel"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      project.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                      project.status === "IN_REVIEW" ? "bg-indigo-100 text-indigo-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {project.status === "COMPLETED" ? "✓ Projet Finalisé" :
                       project.status === "IN_REVIEW" ? "En révision encadreurs" :
                       "En cours de réalisation"}
                    </span>
                    {daysLeft !== null && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                        daysLeft < 15 ? "bg-danger-100 text-danger-700" : "bg-neutral-100 text-neutral-600"
                      }`}>
                        <IconCalendar size={13} />
                        {daysLeft > 0 ? `J-${daysLeft} avant soutenance` : "Date dépassée"}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold font-display text-neutral-900 leading-snug">
                    {project.title}
                  </h1>
                  <p className="text-sm text-neutral-600 font-body mt-2 leading-relaxed">
                    {project.description || "Aucune description renseignée."}
                  </p>

                  {/* Tags */}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      {project.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-0.5 rounded-md font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3.5 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconEdit size={14} />}
                    onClick={openEditProject}
                  >
                    Paramètres du projet
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6 pt-5 border-t border-neutral-100">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 mb-2">
                  <span className="flex items-center gap-2">
                    Progression globale du PFE :
                    <span className="text-primary-600 font-display text-sm">{project.progress || 0}%</span>
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => adjustProgress(-10)}
                      disabled={!project.progress || project.progress <= 0}
                      className="px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded text-neutral-700 disabled:opacity-40 cursor-pointer"
                    >
                      -10%
                    </button>
                    <button
                      onClick={() => adjustProgress(10)}
                      disabled={project.progress >= 100}
                      className="px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded text-neutral-700 disabled:opacity-40 cursor-pointer"
                    >
                      +10%
                    </button>
                  </div>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      (project.progress || 0) >= 100 ? "bg-emerald-500" :
                      (project.progress || 0) >= 50 ? "bg-primary-600" :
                      "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, project.progress || 0))}%` }}
                  />
                </div>
              </div>

              {/* Stats ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-100">
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">{project.students?.length || (project.co_student_id ? 2 : 1)}</p>
                  <p className="text-xs text-neutral-500 font-body">Étudiants (Équipe)</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">{project.encadrers?.length || (project.encadrer_id ? 1 : 0)}</p>
                  <p className="text-xs text-neutral-500 font-body">Encadreurs connectés</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-primary-600">{totalVersionsCount}</p>
                  <p className="text-xs text-neutral-500 font-body">Livrables déposés</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">
                    {daysLeft !== null ? `${daysLeft}j` : "--"}
                  </p>
                  <p className="text-xs text-neutral-500 font-body">Délai soutenance</p>
                </div>
              </div>
            </Card>

            {/* ── MODULE CARDS: RÉUNIONS & CERTIFICAT ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Meeting Logs */}
              <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <IconCalendar size={20} />
                    </span>
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                      Suivi Hebdomadaire
                    </span>
                  </div>
                  <h3 className="font-bold text-neutral-900 text-base">Journal de Réunions & Blocages</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed font-body">
                    Documentez vos séances de travail, soumettez vos comptes-rendus et recevez les validations formelles de vos encadreurs.
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDashboardTab("meetings")}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Ouvrir le Journal des Réunions →
                  </Button>
                </div>
              </div>

              {/* Card 2: Certificate */}
              <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <IconAward size={20} />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                      Dépôt Officiel
                    </span>
                  </div>
                  <h3 className="font-bold text-neutral-900 text-base">Certificat Officiel de Dépôt PFE</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed font-body">
                    Attestation infalsifiable avec QR code de vérification pour l'administration et l'autorisation de soutenance.
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDashboardTab("certificate")}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Consulter le Certificat de Dépôt →
                  </Button>
                </div>
              </div>
            </div>

            {/* ── 2 CARDS ROW: BINÔME & MULTI-ENCADREURS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 👥 CARTE ÉQUIPE ÉTUDIANTS / BINÔME */}
              <Card className="p-5 sm:p-6 border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                      <span>👥</span> Équipe d'Étudiants
                    </h2>
                    <p className="text-xs text-neutral-500 font-body">
                      Projet individuel ou binôme partagé (2 étudiants)
                    </p>
                  </div>
                  {!project.co_student_id && !pendingBinomeInviteSent && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<IconPlus size={14} />}
                      onClick={() => setIsBinomeModalOpen(true)}
                    >
                      Inviter un binôme
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Student 1 (Creator) */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <div className="flex items-center gap-3">
                      <Avatar name={project.student_name || "Étudiant 1"} role="Student" size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-neutral-900 text-xs">{project.student_name || "Étudiant principal"}</p>
                          <span className="text-[10px] bg-primary-100 text-primary-800 font-semibold px-2 py-0.5 rounded-full">Porteur du projet</span>
                        </div>
                        <p className="text-neutral-500 text-[11px] font-mono">{project.student_email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student 2 (Binôme) or Invitation Status */}
                  {project.co_student_id ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                      <div className="flex items-center gap-3">
                        <Avatar name={project.co_student_name || "Binôme"} role="Student" size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900 text-xs">{project.co_student_name}</p>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">Binôme partenaire</span>
                          </div>
                          <p className="text-neutral-500 text-[11px] font-mono">{project.co_student_email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveBinome}
                        className="text-danger-600 hover:bg-danger-50 !text-xs !py-1"
                      >
                        Dissocier
                      </Button>
                    </div>
                  ) : pendingBinomeInviteSent ? (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-amber-900">Invitation envoyée</p>
                        <p className="text-amber-700 text-[11px] font-mono">{pendingBinomeInviteSent.encadrer_email} (En attente)</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await api.cancelInvitation(pendingBinomeInviteSent.id)
                          toast.info("Invitation annulée.")
                          await loadData()
                        }}
                        className="text-amber-800 hover:bg-amber-100 !text-xs"
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-neutral-300 text-center space-y-2">
                      <p className="text-xs text-neutral-500">Vous travaillez actuellement seul(e) sur ce projet.</p>
                      <Button size="sm" variant="secondary" onClick={() => setIsBinomeModalOpen(true)}>
                        Travailler en binôme
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* 🎓 CARTE DOUBLE ENCADREMENT (ACADÉMIQUE & ENTREPRISE) */}
              <Card className="p-5 sm:p-6 border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                      <span>🎓</span> Double Encadrement
                    </h2>
                    <p className="text-xs text-neutral-500 font-body">
                      Encadreur Universitaire & Tuteur en Entreprise
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconPlus size={14} />}
                    onClick={() => setIsSupervisorModalOpen(true)}
                  >
                    Inviter un encadreur
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* Slot 1: Encadreur Académique */}
                  {project.academic_encadrer ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-200">
                      <div className="flex items-center gap-3">
                        <Avatar name={project.academic_encadrer.name} role="Encadreur" size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900 text-xs">{project.academic_encadrer.name}</p>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Académique (Professeur)</span>
                          </div>
                          <p className="text-neutral-500 text-[11px] font-mono">{project.academic_encadrer.email}</p>
                          {project.academic_encadrer.faculty && <p className="text-[10px] text-neutral-400">{project.academic_encadrer.faculty}</p>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSupervisor(project.academic_encadrer!.id, "académique")}
                        className="text-neutral-400 hover:text-danger-600 !py-1 !px-2"
                        title="Retirer cet encadreur"
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/20 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-neutral-700">Encadreur Académique</p>
                        <p className="text-neutral-400 text-[11px]">Professeur d'université non assigné</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSupervisorRoleToInvite("ACADEMIC")
                          setIsSupervisorModalOpen(true)
                        }}
                      >
                        Inviter
                      </Button>
                    </div>
                  )}

                  {/* Slot 2: Encadreur Entreprise */}
                  {project.enterprise_encadrer ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/50 border border-teal-200">
                      <div className="flex items-center gap-3">
                        <Avatar name={project.enterprise_encadrer.name} role="Encadreur" size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900 text-xs">{project.enterprise_encadrer.name}</p>
                            <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">Entreprise (Tuteur)</span>
                          </div>
                          <p className="text-neutral-500 text-[11px] font-mono">{project.enterprise_encadrer.email}</p>
                          {project.enterprise_encadrer.faculty && <p className="text-[10px] text-neutral-400">{project.enterprise_encadrer.faculty}</p>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSupervisor(project.enterprise_encadrer!.id, "d'entreprise")}
                        className="text-neutral-400 hover:text-danger-600 !py-1 !px-2"
                        title="Retirer cet encadreur"
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-teal-200 bg-teal-50/20 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-neutral-700">Encadreur Entreprise</p>
                        <p className="text-neutral-400 text-[11px]">Tuteur ou mentor en entreprise non assigné</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSupervisorRoleToInvite("ENTERPRISE")
                          setIsSupervisorModalOpen(true)
                        }}
                      >
                        Inviter
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── TRACKER DE DOUBLE VALIDATION ── */}
            {dualValidation && (
              <Card className="p-6 border-neutral-200 bg-white shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⚖️</span>
                      <h2 className="text-base font-bold font-display text-neutral-900">
                        Workflow de Double Validation — Version {dualValidation.version_number}
                      </h2>
                    </div>
                    <p className="text-xs text-neutral-500 font-body">
                      La soutenance finale requiert l'approbation conjointe de vos deux encadreurs.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      dualValidation.is_fully_approved ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                      dualValidation.requires_changes ? "bg-amber-100 text-amber-800 border border-amber-300" :
                      "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}>
                      {dualValidation.is_fully_approved ? "✓ Double Accord Obtenu" :
                       dualValidation.requires_changes ? "⚠️ Corrections Requises" :
                       "⏳ En cours d'examen"}
                    </span>
                    <a
                      href={api.getEvaluationPdfUrl(dualValidation.report_id, dualValidation.version_number)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
                      title="Télécharger la fiche officielle"
                    >
                      <IconDownload size={13} />
                      PV Officiel (PDF)
                    </a>
                  </div>
                </div>

                {/* Stepper Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {/* Step 1: Académique */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">1. Avis Académique</span>
                      {dualValidation.academic_evaluation ? (
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          dualValidation.academic_approved ? "bg-emerald-100 text-emerald-800" :
                          dualValidation.academic_evaluation.approval_status === "CORRECTIONS_REQUIRED" ? "bg-amber-100 text-amber-800" :
                          "bg-neutral-200 text-neutral-700"
                        }`}>
                          {dualValidation.academic_approved ? "Approuvé ✓" :
                           dualValidation.academic_evaluation.approval_status === "CORRECTIONS_REQUIRED" ? "Corrections" : "En cours"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">En attente</span>
                      )}
                    </div>
                    {dualValidation.academic_evaluation ? (
                      <div>
                        <p className="text-neutral-700 font-semibold">{dualValidation.academic_evaluation.encadrer_name}</p>
                        <p className="text-lg font-bold text-blue-700 mt-1">{dualValidation.academic_evaluation.grade.toFixed(1)} / 20</p>
                        {dualValidation.academic_evaluation.feedback && (
                          <p className="text-[11px] text-neutral-500 italic mt-1 line-clamp-2">
                            « {dualValidation.academic_evaluation.feedback} »
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-400 italic">L'encadreur académique n'a pas encore saisi son évaluation sur cette version.</p>
                    )}
                  </div>

                  {/* Step 2: Entreprise */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">2. Avis Entreprise</span>
                      {dualValidation.enterprise_evaluation ? (
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          dualValidation.enterprise_approved ? "bg-emerald-100 text-emerald-800" :
                          dualValidation.enterprise_evaluation.approval_status === "CORRECTIONS_REQUIRED" ? "bg-amber-100 text-amber-800" :
                          "bg-neutral-200 text-neutral-700"
                        }`}>
                          {dualValidation.enterprise_approved ? "Approuvé ✓" :
                           dualValidation.enterprise_evaluation.approval_status === "CORRECTIONS_REQUIRED" ? "Corrections" : "En cours"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">En attente</span>
                      )}
                    </div>
                    {dualValidation.enterprise_evaluation ? (
                      <div>
                        <p className="text-neutral-700 font-semibold">{dualValidation.enterprise_evaluation.encadrer_name}</p>
                        <p className="text-lg font-bold text-teal-700 mt-1">{dualValidation.enterprise_evaluation.grade.toFixed(1)} / 20</p>
                        {dualValidation.enterprise_evaluation.feedback && (
                          <p className="text-[11px] text-neutral-500 italic mt-1 line-clamp-2">
                            « {dualValidation.enterprise_evaluation.feedback} »
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-400 italic">Le tuteur en entreprise n'a pas encore validé cette version.</p>
                    )}
                  </div>

                  {/* Step 3: Décision Globale */}
                  <div className={`p-4 rounded-xl border space-y-2 text-xs flex flex-col justify-between ${
                    dualValidation.is_fully_approved ? "bg-emerald-50 border-emerald-200 text-emerald-950" :
                    dualValidation.requires_changes ? "bg-amber-50 border-amber-200 text-amber-950" :
                    "bg-neutral-50 border-neutral-200 text-neutral-900"
                  }`}>
                    <div>
                      <p className="font-bold uppercase tracking-wider text-[11px]">3. Décision Finale</p>
                      <p className="mt-1 font-semibold">{dualValidation.summary_message}</p>
                    </div>
                    {dualValidation.requires_changes && (
                      <Button
                        size="sm"
                        onClick={() => onNavigate?.("reports")}
                        className="w-full mt-2"
                      >
                        Déposer une version corrigée
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* ── LOWER SECTION: TÂCHES PARTAGÉES & CALENDRIER & ACTIVITÉ ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Colonne Gauche (2/3) : Tâches d'Équipe & Jalons PFE */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 📋 GESTIONNAIRE DE TÂCHES PARTAGÉES */}
                <Card className="p-5 sm:p-6 border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                        <span>📋</span> Tâches Partagées du Projet
                      </h2>
                      <p className="text-xs text-neutral-500 font-body">
                        Répartition du travail entre vous et votre binôme
                      </p>
                    </div>
                    <Button
                      size="sm"
                      icon={<IconPlus size={14} />}
                      onClick={() => setIsTaskModalOpen(true)}
                    >
                      Ajouter une tâche
                    </Button>
                  </div>

                  {(!project.tasks || project.tasks.length === 0) ? (
                    <div className="text-center py-6 border border-dashed border-neutral-200 rounded-xl">
                      <p className="text-xs text-neutral-500 mb-2">Aucune tâche enregistrée.</p>
                      <Button size="sm" variant="secondary" onClick={() => setIsTaskModalOpen(true)}>
                        Créer une première tâche
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {project.tasks.map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs transition ${
                            t.status === "DONE"
                              ? "bg-neutral-50 border-neutral-200 opacity-60"
                              : "bg-white border-neutral-200 hover:border-primary-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={t.status === "DONE"}
                              onChange={() => handleToggleTask(t)}
                              className="w-4 h-4 rounded text-primary-600 accent-primary-600 cursor-pointer"
                            />
                            <div>
                              <p className={`font-semibold ${t.status === "DONE" ? "line-through text-neutral-400" : "text-neutral-900"}`}>
                                {t.title}
                              </p>
                              {t.description && <p className="text-[11px] text-neutral-500">{t.description}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {t.assigned_name && (
                              <span className="text-[11px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-md font-medium">
                                👤 {t.assigned_name}
                              </span>
                            )}
                            {t.due_date && (
                              <span className="text-[11px] text-neutral-500">
                                📅 {new Date(t.due_date).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="text-neutral-400 hover:text-danger-600 p-1"
                              title="Supprimer la tâche"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* 🎯 Jalons PFE */}
                <Card className="p-5 sm:p-6 border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                        <span>🎯</span> Étapes & Jalons PFE
                      </h2>
                      <p className="text-xs text-neutral-500 font-body">
                        Suivez votre avancement jusqu'à la soutenance
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                      {milestones.filter((m) => m.completed).length} / {milestones.length} terminés
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {milestones.map((m, idx) => (
                      <div
                        key={m.id}
                        onClick={() => toggleMilestone(m.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition cursor-pointer ${
                          m.completed
                            ? "bg-emerald-50/40 border-emerald-200 text-neutral-700"
                            : m.current
                            ? "bg-primary-50/40 border-primary-300 text-neutral-900"
                            : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                              m.completed
                                ? "bg-emerald-600 text-white"
                                : "border border-neutral-300 bg-white text-neutral-400 hover:border-primary-400"
                            }`}
                          >
                            {m.completed ? <IconCheck size={14} /> : idx + 1}
                          </button>
                          <div>
                            <p className={`font-semibold ${m.completed ? "line-through text-neutral-400" : "text-neutral-800"}`}>
                              {m.title}
                            </p>
                            <p className="text-[11px] text-neutral-400">{m.subtitle}</p>
                          </div>
                        </div>

                        <div>
                          {m.completed ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              Validé ✓
                            </span>
                          ) : m.current ? (
                            <span className="text-[11px] font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                              En cours
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-400">À venir</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Colonne Droite (1/3) : Activité Récente & Raccourcis */}
              <div className="space-y-6">
                
                {/* Journal d'activité */}
                <Card className="p-5 border-neutral-200">
                  <h3 className="text-sm font-bold font-display text-neutral-900 mb-3 flex items-center gap-1.5">
                    <span>🕒</span> Journal d'Activité Récent
                  </h3>
                  {(!project.activities || project.activities.length === 0) ? (
                    <p className="text-xs text-neutral-400 italic">Aucune activité enregistrée.</p>
                  ) : (
                    <div className="space-y-3 text-xs max-h-72 overflow-y-auto pr-1">
                      {project.activities.slice(0, 8).map((act) => (
                        <div key={act.id} className="flex items-start gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-neutral-800">{act.details}</p>
                            <p className="text-[10px] text-neutral-400">
                              {act.user_name} • {new Date(act.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Raccourcis */}
                <Card className="p-5 border-neutral-200">
                  <h3 className="text-sm font-bold font-display text-neutral-900 mb-3">
                    ⚡ Actions Rapides
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => onNavigate?.("reports")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/30 transition text-left text-xs font-semibold text-neutral-800"
                    >
                      <span className="flex items-center gap-2">
                        <IconUpload size={15} className="text-primary-600" />
                        Déposer un livrable
                      </span>
                      <IconChevronRight size={14} className="text-neutral-400" />
                    </button>

                    <button
                      onClick={() => onNavigate?.("mock-defense")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition text-left text-xs font-semibold text-neutral-800"
                    >
                      <span className="flex items-center gap-2">
                        <IconAward size={15} className="text-emerald-600" />
                        Soutenance Blanche IA
                      </span>
                      <IconChevronRight size={14} className="text-neutral-400" />
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ── MODAL: INVITER UN BINÔME ── */}
        {isBinomeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                  <span>👥</span> Inviter un Binôme
                </h3>
                <button onClick={() => setIsBinomeModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-neutral-600 font-body">
                  Renseignez l'adresse email de votre coéquipier étudiant. Il recevra une invitation et aura un accès complet au projet.
                </p>
                <Input
                  label="Email de l'étudiant partenaire"
                  type="email"
                  value={binomeEmail}
                  onChange={(e) => setBinomeEmail(e.target.value)}
                  placeholder="etudiant@insat.tn"
                  required
                />
              </div>
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setIsBinomeModalOpen(false)}>Annuler</Button>
                <Button disabled={isInvitingBinome || !binomeEmail.trim()} onClick={handleInviteBinome}>
                  {isInvitingBinome ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: INVITER UN ENCADREUR ── */}
        {isSupervisorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                  <span>🎓</span> Inviter un Encadreur
                </h3>
                <button onClick={() => setIsSupervisorModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                    Type d'encadrement
                  </label>
                  <select
                    value={supervisorRoleToInvite}
                    onChange={(e) => setSupervisorRoleToInvite(e.target.value as SupervisorRole)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="ACADEMIC">Encadreur Académique (Professeur universitaire)</option>
                    <option value="ENTERPRISE">Encadreur Entreprise (Tuteur de stage / Société)</option>
                  </select>
                </div>

                <Input
                  label="Email de l'encadreur"
                  type="email"
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  placeholder="professeur@universite.tn ou tuteur@entreprise.com"
                  required
                />
              </div>
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setIsSupervisorModalOpen(false)}>Annuler</Button>
                <Button disabled={isInvitingSupervisor || !supervisorEmail.trim()} onClick={handleInviteSupervisor}>
                  {isInvitingSupervisor ? "Envoi..." : "Inviter l'encadreur"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: NOUVELLE TÂCHE PARTAGÉE ── */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                  <span>📋</span> Créer une Tâche Partagée
                </h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <Input
                  label="Intitulé de la tâche"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex : Corriger les diagrammes de séquence UML"
                  required
                />
                <Input
                  label="Détails / Description"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Notes, fichiers ou liens pertinents..."
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                    Assigner à
                  </label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-body text-neutral-800"
                  >
                    <option value="">Non assigné</option>
                    {project?.student_id && <option value={project.student_id}>{project.student_name || "Moi"}</option>}
                    {project?.co_student_id && <option value={project.co_student_id}>{project.co_student_name || "Mon Binôme"}</option>}
                  </select>
                </div>

                <Input
                  label="Date limite d'exécution"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setIsTaskModalOpen(false)}>Annuler</Button>
                <Button disabled={isSavingTask || !taskTitle.trim()} onClick={handleCreateTask}>
                  {isSavingTask ? "Création..." : "Enregistrer la tâche"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: PARAMÈTRES DU PROJET ── */}
        {isEditProjectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-neutral-900">Paramètres du projet PFE</h3>
                <button onClick={() => setIsEditProjectOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
              </div>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <Input label="Titre du projet" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                <Input label="Description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">Statut du projet</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-body text-neutral-800"
                    >
                      <option value="ACTIVE">En cours</option>
                      <option value="IN_REVIEW">En révision encadreurs</option>
                      <option value="COMPLETED">Finalisé</option>
                      <option value="ARCHIVED">Archivé</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">Progression ({editProgress}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={editProgress}
                      onChange={(e) => setEditProgress(Number(e.target.value))}
                      className="w-full accent-primary-600 mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Date de soutenance / Deadline" type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                  <Input label="Technologies & Mots-clés" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Séparés par des virgules" />
                </div>
              </div>
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setIsEditProjectOpen(false)}>Annuler</Button>
                <Button disabled={isSavingProject} onClick={handleSaveProject}>
                  {isSavingProject ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
