import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar, Input } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { 
  IconReport, IconSparkles, IconChevronRight, 
  IconBell, IconUser, IconCalendar, IconDownload, 
  IconFileText, IconEdit, IconCheck, IconStats, IconPlus, IconUpload 
} from "../../components/ui/Icons"
import { api, type Project, type ReportHistory, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconStats size={18} /> },
  { key: "reports", label: "Rapports PFE", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil & Encadreur", icon: <IconUser size={18} /> },
]

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
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<ReportHistory[]>([])
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

  const userName = user ? `${user.first_name} ${user.last_name}` : "Karim Boumediene"

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    setNotice("")
    try {
      const [projectData, reportsData] = await Promise.all([
        api.getMyProject().catch(() => null),
        api.getReports().catch(() => []),
      ])
      setProject(projectData)
      setReports(reportsData)
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
      setNotice("Projet mis à jour avec succès.")
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur lors de la mise à jour.")
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
      setNotice("Projet créé avec succès ! Consultez vos rapports et jalons ci-dessous.")
      await loadData()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur lors de la création du projet.")
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

  const totalVersionsCount = useMemo(() => {
    return reports.reduce((acc, r) => acc + (r.versions?.length || 0), 0)
  }, [reports])

  const daysLeft = useMemo(() => daysUntil(project?.deadline), [project?.deadline])

  return (
    <AppShell
      navItems={navItems}
      activeKey="dashboard"
      onNavigate={(key) => {
        if (key === "workshop" && reports.length > 0) {
          const first = reports[0]
          onOpenWorkshop(first.id, String(first.current_version || 1))
        } else if (onNavigate) {
          onNavigate(key)
        }
      }}
      onExit={onExit}
      userName={userName}
      userRole="Étudiant - M2 Informatique"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {notice && (
          <div className="rounded-xl bg-primary-50/80 border border-primary-200 px-4 py-3 text-sm text-primary-800 font-body flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="text-primary-600 hover:text-primary-800 font-bold ml-4">✕</button>
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
                Pour commencer à déposer vos rapports et collaborer avec votre encadreur, renseignez les détails de votre projet.
              </p>
              <div className="space-y-3.5 text-left pt-2">
                <Input
                  label="Titre du projet PFE"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Ex : Plateforme d'évaluation intelligente des rapports PFE"
                  required
                />
                <Input
                  label="Description / Problématique"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Objectif général, contexte académique et périmètre..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Technologies & Mots-clés (séparés par virgules)"
                    value={newProjectTags}
                    onChange={(e) => setNewProjectTags(e.target.value)}
                    placeholder="Python, React, NLP, IA..."
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
        ) : (
          <>
            {/* ── PARTIE DU HAUT : EN-TÊTE ENRICHI DU PROJET ("EL PARTI EL FOUGANIYA") ── */}
            <Card className="overflow-hidden p-6 sm:p-7 relative border-neutral-200">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {project.academic_year || "2025-2026"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      project.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                      project.status === "IN_REVIEW" ? "bg-indigo-100 text-indigo-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {project.status === "COMPLETED" ? "✓ Projet Finalisé" :
                       project.status === "IN_REVIEW" ? "En révision encadreur" :
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

                  {project.encadrer_id ? (
                    <div className="flex items-center gap-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-xs">
                      <Avatar name={project.encadrer_name || "Encadreur Assigné"} role="Encadreur" size="sm" />
                      <div>
                        <p className="font-semibold text-neutral-900">{project.encadrer_name || "Encadreur assigné"}</p>
                        <p className="text-neutral-600 font-mono text-[11px]">{project.encadrer_email || "Supervision active"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <span>Pas d'encadreur assigné</span>
                      <button onClick={() => onNavigate?.("profile")} className="underline font-semibold hover:text-amber-900">
                        Inviter
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar section */}
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

              {/* Quick stats ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-100">
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">{reports.length}</p>
                  <p className="text-xs text-neutral-500 font-body">Rapports créés</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">{totalVersionsCount}</p>
                  <p className="text-xs text-neutral-500 font-body">Versions déposées</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-primary-600">{project.progress || 0}%</p>
                  <p className="text-xs text-neutral-500 font-body">Complétion</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-neutral-50/70">
                  <p className="text-xl font-bold font-display text-neutral-900">
                    {daysLeft !== null ? `${daysLeft}j` : "--"}
                  </p>
                  <p className="text-xs text-neutral-500 font-body">Délai soutenance</p>
                </div>
              </div>
            </Card>

            {/* ── NOUVELLES FONCTIONNALITÉS ("ZID FIHA 7AJET O5RINA") ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Colonne Gauche (2/3) : Jalons du PFE + Aperçu Rapide des Rapports */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. Jalons & Calendrier PFE */}
                <Card className="p-5 sm:p-6 border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                        <span>🎯</span> Étapes & Jalons du PFE
                      </h2>
                      <p className="text-xs text-neutral-500 font-body">
                        Suivez votre avancement étape par étape jusqu'à la soutenance
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
                            ? "bg-primary-50/40 border-primary-300 text-neutral-900 shadow-2xs"
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

                {/* 2. Aperçu des Rapports & Bouton vers la page dédiée */}
                <Card className="p-5 sm:p-6 border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold font-display text-neutral-900 flex items-center gap-2">
                        <IconFileText size={18} className="text-primary-600" />
                        Rapports & Documents Déposés
                      </h2>
                      <p className="text-xs text-neutral-500 font-body">
                        Aperçu rapide de vos livrables actifs
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<IconChevronRight size={14} />}
                      onClick={() => onNavigate?.("reports")}
                    >
                      Voir tous les rapports ({reports.length})
                    </Button>
                  </div>

                  {reports.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-neutral-200 rounded-xl">
                      <p className="text-xs text-neutral-500 mb-3">Aucun rapport créé pour le moment.</p>
                      <Button size="sm" icon={<IconPlus size={14} />} onClick={() => onNavigate?.("reports")}>
                        Créer un rapport
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reports.slice(0, 3).map((r) => {
                        const latest = r.versions && r.versions.length > 0 ? r.versions[r.versions.length - 1] : null
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-primary-300 transition text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900 font-display">{r.title}</span>
                                {latest && <StatusBadge variant={statusToBadge(latest.ai_analysis_status)} />}
                              </div>
                              <p className="text-neutral-400">
                                {latest ? `v${latest.version_number} (${latest.original_file_name}) - ${formatFileSize(latest.file_size)}` : "Aucune version"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {latest && (
                                <a
                                  href={api.getDownloadUrl(latest.version_number, r.id)}
                                  download
                                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                                  title="Télécharger"
                                >
                                  <IconDownload size={14} />
                                </a>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onNavigate?.("reports")}
                              >
                                Gérer
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* Colonne Droite (1/3) : Actions Rapides + Conseils IA + Activité */}
              <div className="space-y-6">
                
                {/* 3. Actions Rapides */}
                <Card className="p-5 border-neutral-200">
                  <h3 className="text-sm font-bold font-display text-neutral-900 mb-3">
                    ⚡ Raccourcis Rapides
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => onNavigate?.("reports")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/30 transition text-left text-xs font-semibold text-neutral-800"
                    >
                      <span className="flex items-center gap-2">
                        <IconUpload size={15} className="text-primary-600" />
                        Déposer un rapport
                      </span>
                      <IconChevronRight size={14} className="text-neutral-400" />
                    </button>

                    <button
                      onClick={() => {
                        if (reports.length > 0) {
                          onOpenWorkshop(reports[0].id, String(reports[0].current_version || 1))
                        } else {
                          onNavigate?.("workshop")
                        }
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-ai-400 hover:bg-ai-50/30 transition text-left text-xs font-semibold text-neutral-800"
                    >
                      <span className="flex items-center gap-2">
                        <IconSparkles size={15} className="text-ai-600" />
                        Lancer l'Atelier IA
                      </span>
                      <IconChevronRight size={14} className="text-neutral-400" />
                    </button>

                    <button
                      onClick={() => onNavigate?.("profile")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition text-left text-xs font-semibold text-neutral-800"
                    >
                      <span className="flex items-center gap-2">
                        <IconUser size={15} className="text-neutral-600" />
                        Gérer mon Encadreur
                      </span>
                      <IconChevronRight size={14} className="text-neutral-400" />
                    </button>
                  </div>
                </Card>

                {/* 4. Conseils IA & Méthodologie PFE */}
                <Card className="p-5 border-neutral-200 bg-gradient-to-br from-primary-50/50 to-ai-50/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💡</span>
                    <h3 className="text-sm font-bold font-display text-neutral-900">
                      Conseils IA pour votre PFE
                    </h3>
                  </div>
                  <ul className="text-xs text-neutral-600 space-y-2 font-body list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Structure IMRAD :</strong> Assurez-vous d'avoir une introduction percutante, une méthodologie claire, et des résultats quantifiés.
                    </li>
                    <li>
                      <strong>Norme Bibliographique :</strong> Citez vos sources récentes (2022-2026) au format IEEE ou APA de manière uniforme.
                    </li>
                    <li>
                      <strong>Analyse continue :</strong> Déposez chaque chapitre dès sa finalisation pour bénéficier des retours automatiques.
                    </li>
                  </ul>
                </Card>

                {/* 5. Activité Récente */}
                <Card className="p-5 border-neutral-200">
                  <h3 className="text-sm font-bold font-display text-neutral-900 mb-3 flex items-center gap-1.5">
                    <span>🕒</span> Activité Récente
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-neutral-800">Projet synchronisé</p>
                        <p className="text-[11px] text-neutral-400">Prêt pour les dépôts</p>
                      </div>
                    </div>
                    {reports.length > 0 && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-neutral-800">{reports.length} rapport(s) répertorié(s)</p>
                          <p className="text-[11px] text-neutral-400">Dernière mise à jour récente</p>
                        </div>
                      </div>
                    )}
                    {project.encadrer_id && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-neutral-800">Superviseur actif</p>
                          <p className="text-[11px] text-neutral-400">Suivi académique en cours</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ── MODAL: MODIFIER LE PROJET ── */}
        {isEditProjectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-neutral-900">Paramètres du projet PFE</h3>
                <button
                  onClick={() => setIsEditProjectOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <Input
                  label="Titre du projet"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
                <Input
                  label="Description"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                      Statut du projet
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                      <option value="ACTIVE">En cours</option>
                      <option value="IN_REVIEW">En révision encadreur</option>
                      <option value="COMPLETED">Finalisé</option>
                      <option value="ARCHIVED">Archivé</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                      Progression ({editProgress}%)
                    </label>
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
                  <Input
                    label="Date de soutenance / Deadline"
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                  />
                  <Input
                    label="Technologies & Mots-clés"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="Séparés par des virgules"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" size="md" onClick={() => setIsEditProjectOpen(false)}>
                  Annuler
                </Button>
                <Button size="md" disabled={isSavingProject} onClick={handleSaveProject}>
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
