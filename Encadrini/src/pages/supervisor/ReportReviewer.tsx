import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { IconReport, IconBell, IconSparkles, IconUpload, IconUser, IconCalendar, IconAward, IconShield } from "../../components/ui/Icons"
import { DocumentViewer } from "../../components/ui/DocumentViewer"
import { useToast } from "../../components/ui/Toast"
import { MeetingLogsView } from "../../components/meetings/MeetingLogsView"
import { CertificateView } from "../../components/certificates/CertificateView"
import {
  api,
  type Annotation,
  type Evaluation,
  type ApprovalStatus,
  type Project,
  type ReportHistory,
  type User,
  type PendingSupervisorInvitation,
  type DualValidationVersionStatus,
  type SupervisorRole,
} from "../../lib/api"
import { ENCADRER_NAV_ITEMS } from "../../lib/navItems"

function statusToBadge(status?: string): BadgeVariant {
  if (status === "COMPLETED") return "analysed"
  if (status === "PROCESSING") return "reviewing"
  if (status === "FAILED") return "rejected"
  return "pending"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  )
}


export function ReportReviewer({
  onExit,
  onNavigate,
  user,
  initialTab = "reports",
  onTabChange,
}: {
  onExit: () => void
  onNavigate?: (key: string) => void
  user?: User | null
  initialTab?: "reports" | "meetings" | "certificate"
  onTabChange?: () => void
}) {
  const { toast, confirm } = useToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.5)

  const [supervisedProjects, setSupervisedProjects] = useState<Project[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingSupervisorInvitation[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<ReportHistory[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>("")
  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)

  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [draft, setDraft] = useState("")
  const [pendingSelection, setPendingSelection] = useState<{
    text: string; x: number; y: number; width: number; height: number
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  // Right Reviewer Workspace Tab state
  const [activeReviewTab, setActiveReviewTab] = useState<"annotations" | "validation" | "evaluation">("annotations")
  const [supervisorTab, setSupervisorTab] = useState<"reports" | "meetings" | "certificate">(initialTab)
  const [annotationFilter, setAnnotationFilter] = useState<"all" | "currentPage">("all")

  // Sync tab when navigating back from another page with a specific tab
  useEffect(() => {
    if (initialTab !== supervisorTab) {
      setSupervisorTab(initialTab)
    }
    onTabChange?.()
  }, [initialTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Evaluation state
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [dualValidation, setDualValidation] = useState<DualValidationVersionStatus | null>(null)
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({})
  const [grade, setGrade] = useState<string>("")
  const [feedback, setFeedback] = useState("")
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("PENDING_REVIEW")
  const [isSavingEval, setIsSavingEval] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [evalNotice, setEvalNotice] = useState("")

  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const isEnterprise = useMemo(() => {
    return project?.enterprise_encadrer_id === user?.id
  }, [project, user])

  const currentSupervisorRole: SupervisorRole = isEnterprise ? "ENTERPRISE" : "ACADEMIC"

  const pdfUrl = useMemo(() => {
    if (!history) return ""
    return api.getDownloadUrl(versionNumber, history.id)
  }, [history, versionNumber])

  const selectedVersion = useMemo(
    () => history?.versions.find((v) => v.version_number === versionNumber),
    [history, versionNumber],
  )

  const userName = user ? `${user.first_name} ${user.last_name}` : "Encadreur"

  // Annotations sorted by page + creation
  const sortedAnnotations = useMemo(
    () => [...annotations].sort((a, b) => a.page_number - b.page_number || a.created_at.localeCompare(b.created_at)),
    [annotations],
  )
  const annotatedPages = useMemo(() => new Set(annotations.map((a) => a.page_number)), [annotations])

  const filteredAnnotations = useMemo(() => {
    if (annotationFilter === "currentPage") {
      return sortedAnnotations.filter((a) => a.page_number === currentPage)
    }
    return sortedAnnotations
  }, [sortedAnnotations, annotationFilter, currentPage])

  const navItems = useMemo(() => {
    return ENCADRER_NAV_ITEMS.map((item) => {
      if (item.key === "reports") {
        return { ...item, badge: supervisedProjects.length > 0 ? supervisedProjects.length : null }
      }
      if (item.key === "notifications") {
        return { ...item, badge: pendingInvitations.length > 0 ? `${pendingInvitations.length}` : null }
      }
      return item
    })
  }, [supervisedProjects.length, pendingInvitations.length])

  // ---------- data loading ----------

  const loadData = async (targetProjectId?: string) => {
    if (!user) return
    setIsLoading(true)
    setNotice("")
    try {
      const [projectsList, pendingInvs] = await Promise.all([
        api.getSupervisedProjects().catch(() => []),
        api.getSupervisorPendingInvitations().catch(() => []),
      ])

      setSupervisedProjects(projectsList)
      setPendingInvitations(pendingInvs)

      let currentProj: Project | null = null
      if (targetProjectId) currentProj = projectsList.find((p) => p.id === targetProjectId) || null
      if (!currentProj && projectsList.length > 0) currentProj = projectsList[0]
      setProject(currentProj)

      if (currentProj) {
        const reportsData = await api.getReports(currentProj.id).catch(() => [])
        setReports(reportsData)
        if (reportsData.length > 0) {
          const first = reportsData[0]
          setSelectedReportId(first.id)
          setHistory(first)
          setVersionNumber(first.current_version || 1)
          setCurrentPage(1)
        } else {
          setSelectedReportId("")
          setHistory(null)
          setAnnotations([])
        }
      } else {
        setReports([])
        setSelectedReportId("")
        setHistory(null)
        setAnnotations([])
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Impossible de charger les données.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load annotations + evaluation whenever history/version changes
  useEffect(() => {
    let isMounted = true
    const load = async () => {
      if (!history) return

      // Load annotations
      try {
        const data = await api.getAnnotations(history.id, versionNumber)
        if (isMounted) setAnnotations(data)
      } catch {
        if (isMounted) setAnnotations([])
      }

      // Load evaluation & dual-validation status
      const [eval_, dual_] = await Promise.all([
        api.getEvaluation(history.id, versionNumber).catch(() => null),
        api.getVersionDualValidation(history.id, versionNumber).catch(() => null),
      ])
      if (isMounted) {
        setEvaluation(eval_)
        setDualValidation(dual_)
        setGrade(eval_ ? String(eval_.grade) : "")
        setFeedback(eval_?.feedback ?? "")
        setApprovalStatus(eval_?.approval_status ?? "PENDING_REVIEW")
        setCriteriaScores(eval_?.criteria_ratings ?? {})
      }
    }
    load()
    return () => { isMounted = false }
  }, [history, versionNumber])

  // ---------- project/report selection ----------

  const handleProjectSelect = async (projectId: string) => {
    const selected = supervisedProjects.find((p) => p.id === projectId)
    if (!selected) return
    setProject(selected)
    setIsLoading(true)
    try {
      const reportsData = await api.getReports(selected.id).catch(() => [])
      setReports(reportsData)
      if (reportsData.length > 0) {
        const first = reportsData[0]
        setSelectedReportId(first.id)
        setHistory(first)
        setVersionNumber(first.current_version || 1)
        setCurrentPage(1)
      } else {
        setSelectedReportId("")
        setHistory(null)
        setAnnotations([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReportChange = (reportId: string) => {
    setSelectedReportId(reportId)
    const found = reports.find((r) => r.id === reportId)
    if (found) {
      setHistory(found)
      setVersionNumber(found.current_version || 1)
      setCurrentPage(1)
    }
  }

  // ---------- invitation handlers ----------

  const handleAcceptInvitation = async (invitationId: string) => {
    setActionLoadingId(invitationId)
    try {
      const acceptedProject = await api.acceptInvitationById(invitationId)
      toast.success("Invitation acceptée avec succès ! Vous supervisez désormais ce projet.")
      await loadData(acceptedProject.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'acceptation.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeclineInvitation = (invitationId: string) => {
    confirm({
      title: "Refuser l'invitation ?",
      message: "Êtes-vous certain de vouloir refuser cette demande d'encadrement ? Cette action ne peut pas être annulée.",
      confirmText: "Refuser l'invitation",
      cancelText: "Annuler",
      variant: "danger",
      onConfirm: async () => {
        setActionLoadingId(invitationId)
        try {
          await api.declineInvitationById(invitationId)
          setPendingInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId))
          toast.info("L'invitation a été déclinée.")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erreur lors du refus.")
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  // ---------- annotation handlers ----------

  const submitAnnotation = async () => {
    if (!draft.trim() || !history) return
    setIsSubmitting(true)
    setNotice("")
    try {
      const annotation = await api.createAnnotation(
        history.id,
        versionNumber,
        currentPage,
        draft.trim(),
        pendingSelection
          ? {
              selected_text: pendingSelection.text,
              x: pendingSelection.x,
              y: pendingSelection.y,
              width: pendingSelection.width,
              height: pendingSelection.height,
            }
          : undefined,
      )
      setAnnotations((prev) => [...prev, annotation])
      setDraft("")
      setPendingSelection(null)
      toast.success("Annotation enregistrée avec succès.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer l'annotation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (ann: Annotation) => {
    setEditingId(ann.id)
    setEditContent(ann.content)
  }

  const saveEdit = async (ann: Annotation) => {
    if (!editContent.trim()) return
    try {
      const updated = await api.updateAnnotation(ann.id, editContent.trim())
      setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? updated : a)))
      setEditingId(null)
      toast.success("Annotation mise à jour.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier l'annotation.")
    }
  }

  const deleteAnnotation = (ann: Annotation) => {
    confirm({
      title: "Supprimer l'annotation ?",
      message: `Voulez-vous supprimer cette annotation sur la page ${ann.page_number} ?`,
      confirmText: "Supprimer",
      cancelText: "Annuler",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.deleteAnnotation(ann.id)
          setAnnotations((prev) => prev.filter((a) => a.id !== ann.id))
          toast.success("Annotation supprimée.")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Impossible de supprimer l'annotation.")
        }
      },
    })
  }

  const handleAnnotationClick = (ann: Annotation) => {
    setCurrentPage(ann.page_number)
  }

  const handleTextSelect = (_page: number, info: { text: string; x: number; y: number; width: number; height: number }) => {
    setPendingSelection(info)
    setDraft((prev) => prev || `"${info.text.slice(0, 80)}" — `)
  }

  // ---------- evaluation handlers ----------

  const saveEvaluation = async () => {
    if (!history) return
    const gradeNum = parseFloat(grade)
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 20) {
      setEvalNotice("La note doit être un nombre entre 0 et 20.")
      toast.warning("La note doit être comprise entre 0 et 20.")
      return
    }
    setIsSavingEval(true)
    setEvalNotice("")
    try {
      const saved = await api.saveEvaluation(
        history.id,
        versionNumber,
        gradeNum,
        feedback.trim() || undefined,
        approvalStatus,
        currentSupervisorRole,
        criteriaScores
      )
      setEvaluation(saved)
      const updatedDual = await api.getVersionDualValidation(history.id, versionNumber).catch(() => null)
      setDualValidation(updatedDual)
      setEvalNotice("✅ Évaluation et statut sauvegardés.")
      toast.success("Évaluation et décision enregistrées avec succès !")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossible de sauvegarder l'évaluation."
      setEvalNotice(msg)
      toast.error(msg)
    } finally {
      setIsSavingEval(false)
    }
  }

  // ---------- download official evaluation PDF ----------

  const downloadEvaluationPdf = async () => {
    if (!history) return
    setIsExportingPdf(true)
    try {
      const response = await fetch(api.getEvaluationPdfUrl(history.id, versionNumber), {
        headers: api.getAuthHeaders(),
      })
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Veuillez d'abord sauvegarder une note avant d'exporter la fiche.")
        }
        throw new Error("Impossible de générer le document PDF.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Fiche_Evaluation_${project?.student_name || "etudiant"}_v${versionNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Fiche d'évaluation PDF exportée avec succès.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export PDF.")
    } finally {
      setIsExportingPdf(false)
    }
  }

  // ---------- download ----------

  const downloadVersion = async () => {
    if (!history) return
    try {
      const response = await fetch(api.getDownloadUrl(versionNumber, history.id), { headers: api.getAuthHeaders() })
      if (!response.ok) throw new Error("Téléchargement impossible.")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = selectedVersion?.original_file_name ?? `rapport_v${versionNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Téléchargement impossible.")
    }
  }

  // ---------- sidebar content ----------

  const sidebarProjectsExtra = (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-display">
          Projets Supervisés ({supervisedProjects.length})
        </span>
        {pendingInvitations.length > 0 && (
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {pendingInvitations.length} attente
          </span>
        )}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 text-xs space-y-1.5 shadow-2xs">
          <p className="font-semibold text-amber-950 flex items-center gap-1">
            <span>📬</span> Demande d'encadrement ({pendingInvitations.length})
          </p>
          <p className="text-[11px] text-amber-800 font-body">
            <strong>{pendingInvitations[0].student_name}</strong> pour « {pendingInvitations[0].project_title} »
          </p>
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => handleAcceptInvitation(pendingInvitations[0].invitation_id)}
              disabled={actionLoadingId === pendingInvitations[0].invitation_id}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] py-1 font-semibold transition-colors cursor-pointer"
            >
              Accepter
            </button>
            <button
              onClick={() => handleDeclineInvitation(pendingInvitations[0].invitation_id)}
              disabled={actionLoadingId === pendingInvitations[0].invitation_id}
              className="px-2 bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-300 rounded text-[11px] py-1 transition-colors cursor-pointer"
            >
              Refuser
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {supervisedProjects.map((p) => {
          const isSelected = project?.id === p.id
          const isProjEnterprise = p.enterprise_encadrer_id === user?.id
          return (
            <button
              key={p.id}
              onClick={() => handleProjectSelect(p.id)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-primary-50/80 border-primary-300 ring-1 ring-primary-300 shadow-2xs"
                  : "bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isProjEnterprise
                      ? "bg-teal-50 text-teal-700 border border-teal-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {isProjEnterprise ? "🏢 Entreprise" : "🏛️ Académique"}
                </span>
                {p.is_binome && (
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded">
                    👥 Binôme
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold truncate ${isSelected ? "text-primary-950 font-display" : "text-neutral-800"}`}>
                {p.title}
              </p>
              <p className="text-[11px] text-neutral-500 font-body truncate mt-0.5">
                👨‍🎓 {p.is_binome
                  ? `${p.student_name} & ${p.co_student_name}`
                  : p.student_name || "Étudiant non assigné"}
              </p>
            </button>
          )
        })}

        {supervisedProjects.length === 0 && (
          <p className="text-xs text-neutral-400 font-body text-center py-4 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
            Aucun projet assigné
          </p>
        )}
      </div>
    </div>
  )

  // ---------- render ----------

  return (
    <AppShell
      navItems={navItems}
      activeKey={supervisorTab}
      onNavigate={(key) => {
        if (key === "reports") setSupervisorTab("reports")
        else if (key === "meetings") setSupervisorTab("meetings")
        else if (key === "certificate") setSupervisorTab("certificate")
        else if (onNavigate) onNavigate(key)
      }}
      onExit={onExit}
      userName={userName}
      userRole="Encadreur"
      userSubtitle={isEnterprise ? "Encadreur Entreprise" : "Encadreur Académique"}
      sidebarExtra={sidebarProjectsExtra}
    >
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Pending Invitations Banner */}
        {pendingInvitations.length > 0 && (
          <div className="p-4 bg-primary-50/90 border border-primary-200 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">📬</span>
              <div>
                <h2 className="text-sm font-bold font-display text-primary-950">
                  Nouvelles invitations d'étudiants en attente ({pendingInvitations.length})
                </h2>
                <p className="text-xs text-primary-700 font-body">
                  Acceptez pour superviser ces projets PFE.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.invitation_id}
                  className="bg-white p-3.5 rounded-lg border border-primary-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-neutral-900">
                      👨‍🎓 Étudiant : <span className="text-primary-700">{inv.student_name}</span>
                    </p>
                    <p className="text-neutral-600 font-medium mt-0.5">Projet : « {inv.project_title} »</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleAcceptInvitation(inv.invitation_id)} disabled={actionLoadingId === inv.invitation_id}>
                      {actionLoadingId === inv.invitation_id ? "Acceptation…" : "Accepter"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeclineInvitation(inv.invitation_id)} disabled={actionLoadingId === inv.invitation_id} className="!text-danger-600 hover:!bg-danger-50">
                      Refuser
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {supervisorTab === "meetings" ? (
          project ? (
            <MeetingLogsView
              project={project}
              currentUser={user}
              onBack={() => setSupervisorTab("reports")}
            />
          ) : (
            <Card className="p-8 text-center text-neutral-500">
              Veuillez sélectionner un projet dans la liste pour consulter son journal de réunions.
            </Card>
          )
        ) : supervisorTab === "certificate" ? (
          project ? (
            <CertificateView
              project={project}
              currentUser={user}
              reports={reports}
            />
          ) : (
            <Card className="p-8 text-center text-neutral-500">
              Veuillez sélectionner un projet dans la liste pour gérer son certificat officiel de dépôt.
            </Card>
          )
        ) : (
          <>
            {/* Header + Selectors */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold font-display text-neutral-900">
              {project?.title ?? "Suivi de rapport étudiant"}
            </h1>
            <p className="text-sm text-neutral-600 font-body mt-1 flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                isEnterprise
                  ? "bg-teal-100 text-teal-800 border border-teal-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {isEnterprise ? "🏢 Encadreur Entreprise" : "🏛️ Encadreur Académique"}
              </span>
              {project?.is_binome ? (
                <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md flex items-center gap-1 text-xs">
                  👥 Binôme : {project.student_name} & {project.co_student_name}
                </span>
              ) : project?.student_name ? (
                <span className="font-semibold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-md text-xs">
                  👨‍🎓 {project.student_name}{project.student_email ? ` (${project.student_email})` : ""}
                </span>
              ) : (
                <span className="text-neutral-400 text-xs">Aucun étudiant connecté</span>
              )}
              {selectedVersion && <StatusBadge variant={statusToBadge(selectedVersion?.ai_analysis_status)} />}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {supervisedProjects.length > 1 && (
              <select
                value={project?.id || ""}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="text-xs font-body border border-primary-300 rounded-lg px-3 py-2 text-primary-900 bg-primary-50/50 font-semibold focus:ring-2 focus:ring-primary-500"
              >
                {supervisedProjects.map((p) => (
                  <option key={p.id} value={p.id}>🎓 {p.student_name ? `${p.student_name} – ` : ""}{p.title}</option>
                ))}
              </select>
            )}

            {reports.length > 0 && (
              <select
                value={selectedReportId}
                onChange={(e) => handleReportChange(e.target.value)}
                className="text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 bg-white font-semibold"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>📄 {r.title} ({r.report_type})</option>
                ))}
              </select>
            )}

            <select
              value={versionNumber}
              onChange={(e) => { setVersionNumber(Number(e.target.value)); setCurrentPage(1) }}
              className="text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 text-neutral-700 bg-white"
              disabled={!history || !history.versions?.length}
            >
              {(history?.versions ?? []).map((v) => (
                <option key={v.version_number} value={v.version_number}>
                  Version {v.version_number} — {formatDate(v.uploaded_at)}
                </option>
              ))}
              {!history?.versions?.length && <option>Pas de version</option>}
            </select>

            <Button variant="secondary" size="sm" icon={<IconUpload size={14} />} onClick={downloadVersion} disabled={!history || !selectedVersion}>
              Télécharger
            </Button>
          </div>
        </div>

        {notice && (
          <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-body">{notice}</p>
        )}

        {!project ? (
          <Card className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
              <IconReport size={24} />
            </div>
            <h2 className="text-base font-bold font-display text-neutral-800">Aucun projet assigné</h2>
            <p className="text-sm text-neutral-500 font-body max-w-md mx-auto">
              Dès qu'un étudiant vous invite et que vous acceptez, son projet apparaîtra ici.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
            {/* ── PDF Viewer Panel ── */}
            <Card padded={false} className="overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 bg-neutral-50/70">
                {/* Page navigation */}
                <div className="flex items-center gap-3">
                  <button
                    className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    title="Page précédente"
                  >
                    <span className="text-sm font-semibold">←</span>
                  </button>
                  <span className="text-sm font-medium font-body text-neutral-700">
                    Page {currentPage} / {totalPages > 0 ? totalPages : 1}
                  </span>
                  <button
                    className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors"
                    onClick={() => setCurrentPage((p) => totalPages > 0 ? Math.min(totalPages, p + 1) : p + 1)}
                    disabled={totalPages > 0 && currentPage >= totalPages}
                    title="Page suivante"
                  >
                    <span className="text-sm font-semibold">→</span>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded px-1.5 py-0.5 shadow-2xs">
                    <button className="px-1.5 py-0.5 text-xs text-neutral-500 hover:text-neutral-800" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}>−</button>
                    <span className="text-xs font-body text-neutral-500 w-10 text-center">{Math.round(scale * 100)}%</span>
                    <button className="px-1.5 py-0.5 text-xs text-neutral-500 hover:text-neutral-800" onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}>+</button>
                  </div>

                  <span className="text-sm text-neutral-500 font-body truncate max-w-[300px]">
                    {isLoading ? "Chargement…" : selectedVersion?.original_file_name ?? "rapport.pdf"}
                  </span>
                </div>
              </div>

              {/* Document canvas area */}
              <div className="bg-[#f3f4f6] py-10 px-4 flex justify-center overflow-auto min-h-[550px]">
                {!history || !selectedVersion ? (
                  <div className="flex items-center justify-center w-full h-64 text-neutral-400">
                    <div className="text-center">
                      <p className="text-3xl mb-2">📄</p>
                      <p className="text-sm font-body">Aucun rapport sélectionné</p>
                    </div>
                  </div>
                ) : (
                  <DocumentViewer
                    url={pdfUrl}
                    authHeaders={api.getAuthHeaders()}
                    mimeType={selectedVersion.original_mime_type}
                    fileName={selectedVersion.original_file_name}
                    currentPage={currentPage}
                    scale={scale}
                    onLoad={(n) => setTotalPages(n)}
                    onTextSelect={handleTextSelect}
                    annotations={annotations}
                    onAnnotationClick={handleAnnotationClick}
                  />
                )}
              </div>

              {/* Page strip */}
              {totalPages > 0 && (
                <div className="flex gap-1 px-4 py-2.5 border-t border-neutral-200 overflow-x-auto">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`relative flex-shrink-0 w-7 h-9 rounded border text-[10px] font-body flex items-center justify-center transition-colors ${
                        p === currentPage
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                      }`}
                    >
                      {p}
                      {annotatedPages.has(p) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* ── Right Workspace Sidebar (Tabs: Annotations, Double Validation, Évaluation) ── */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-20">
              {/* Tabs Bar */}
              <div className="bg-neutral-100 p-1 rounded-xl flex items-center gap-1 border border-neutral-200">
                <button
                  onClick={() => setActiveReviewTab("annotations")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeReviewTab === "annotations"
                      ? "bg-white text-primary-700 shadow-2xs font-display"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <span>💬 Notes</span>
                  <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full font-bold">
                    {annotations.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveReviewTab("validation")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeReviewTab === "validation"
                      ? "bg-white text-primary-700 shadow-2xs font-display"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <span>⚖️ Validation</span>
                  {dualValidation && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        dualValidation.is_fully_approved
                          ? "bg-emerald-500"
                          : dualValidation.requires_changes
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveReviewTab("evaluation")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeReviewTab === "evaluation"
                      ? "bg-white text-primary-700 shadow-2xs font-display"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <span>⭐ Note</span>
                  {evaluation && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                      {evaluation.grade.toFixed(1)}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab 1: Annotations */}
              {activeReviewTab === "annotations" && (
                <Card padded={false} className="flex flex-col shadow-sm">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
                    <h2 className="font-semibold font-display text-neutral-800 text-sm">
                      💬 Annotations ({annotations.length})
                    </h2>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        onClick={() => setAnnotationFilter("all")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          annotationFilter === "all"
                            ? "bg-neutral-200 text-neutral-900 font-semibold"
                            : "text-neutral-500 hover:text-neutral-800"
                        }`}
                      >
                        Toutes
                      </button>
                      <button
                        onClick={() => setAnnotationFilter("currentPage")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          annotationFilter === "currentPage"
                            ? "bg-primary-100 text-primary-700 font-semibold"
                            : "text-neutral-500 hover:text-neutral-800"
                        }`}
                      >
                        Page {currentPage}
                      </button>
                    </div>
                  </div>

                  {/* Annotation list */}
                  <div className="flex-1 overflow-y-auto max-h-[360px] p-3 space-y-2">
                    {filteredAnnotations.length === 0 ? (
                      <p className="text-xs text-neutral-400 font-body text-center py-6">
                        {annotationFilter === "currentPage"
                          ? `Aucune annotation sur la page ${currentPage}.`
                          : "Aucune annotation dans ce rapport."}
                      </p>
                    ) : (
                      filteredAnnotations.map((ann) => (
                        <div
                          key={ann.id}
                          className={`rounded-lg p-2.5 border transition-all cursor-pointer ${
                            ann.page_number === currentPage
                              ? "border-primary-300 bg-primary-50/50 shadow-2xs"
                              : "border-neutral-200 bg-white hover:border-neutral-300"
                          }`}
                          onClick={() => handleAnnotationClick(ann)}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">
                                P.{ann.page_number}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-body">
                                {formatDate(ann.created_at)}
                              </span>
                            </div>
                            {ann.author_id === user?.id && editingId !== ann.id && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEdit(ann)
                                  }}
                                  className="text-[10px] text-neutral-400 hover:text-primary-600 px-1 cursor-pointer"
                                  title="Modifier"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteAnnotation(ann)
                                  }}
                                  className="text-[10px] text-neutral-400 hover:text-red-600 px-1 cursor-pointer"
                                  title="Supprimer"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>

                          {ann.selected_text && (
                            <p className="text-[10px] text-neutral-500 font-body italic mt-1.5 truncate border-l-2 border-primary-200 pl-1.5">
                              «{ann.selected_text.slice(0, 60)}»
                            </p>
                          )}

                          {editingId === ann.id ? (
                            <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={2}
                                className="w-full text-xs font-body border border-neutral-300 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary-400"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveEdit(ann)}
                                  className="text-[10px] px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 font-semibold cursor-pointer"
                                >
                                  Sauver
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-[10px] px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-50 cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-700 font-body mt-1 leading-relaxed">
                              {ann.content}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add annotation form */}
                  <div className="p-3 border-t border-neutral-200 space-y-2 bg-neutral-50/30">
                    {pendingSelection && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-2.5 py-1.5 flex items-center justify-between">
                        <p className="text-[10px] text-yellow-800 font-body truncate">
                          📌 Sélection : «{pendingSelection.text.slice(0, 45)}»
                        </p>
                        <button
                          onClick={() => setPendingSelection(null)}
                          className="text-yellow-600 hover:text-yellow-800 ml-2 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Ajouter un commentaire sur la page ${currentPage}…`}
                      rows={3}
                      className="w-full text-xs font-body border border-neutral-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                      disabled={!history}
                    />
                    <Button
                      fullWidth
                      size="sm"
                      onClick={submitAnnotation}
                      disabled={!history || isSubmitting || !draft.trim()}
                    >
                      {isSubmitting ? "Enregistrement…" : `Commenter la page ${currentPage}`}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Tab 2: Double Validation */}
              {activeReviewTab === "validation" && (
                <Card padded={false} className="shadow-sm">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
                    <h2 className="font-semibold font-display text-neutral-800 text-sm flex items-center gap-1.5">
                      <span>⚖️</span> Double Validation (v{versionNumber})
                    </h2>
                    {dualValidation && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          dualValidation.is_fully_approved
                            ? "bg-emerald-100 text-emerald-800"
                            : dualValidation.requires_changes
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {dualValidation.workflow_status}
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* Workflow explanation banner */}
                    <div className="bg-primary-50/70 border border-primary-200 rounded-lg p-3 text-[11px] text-primary-900 leading-relaxed">
                      <p className="font-semibold mb-1 flex items-center gap-1">
                        <span>ℹ️</span> Règle de double validation
                      </p>
                      Pour que le rapport soit autorisé pour la soutenance finale, <strong>les deux encadreurs (académique et entreprise)</strong> doivent donner leur validation sur la même version.
                    </div>

                    {/* Academic Supervisor Review */}
                    <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900 flex items-center gap-1">
                          <span>🏛️</span> Encadreur Académique
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dualValidation?.academic_evaluation?.approval_status === "APPROVED_FOR_DEFENSE"
                              ? "bg-emerald-100 text-emerald-800"
                              : dualValidation?.academic_evaluation?.approval_status === "CORRECTIONS_REQUIRED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {dualValidation?.academic_evaluation?.approval_status === "APPROVED_FOR_DEFENSE"
                            ? "Validé"
                            : dualValidation?.academic_evaluation?.approval_status === "CORRECTIONS_REQUIRED"
                            ? "Corrections requises"
                            : "En attente"}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600 space-y-1 pt-1">
                        <div className="flex justify-between">
                          <span>Note attribuée :</span>
                          <strong className="text-neutral-800">
                            {dualValidation?.academic_evaluation?.grade !== undefined
                              ? `${dualValidation.academic_evaluation.grade.toFixed(2)} / 20`
                              : "-- / 20"}
                          </strong>
                        </div>
                        {dualValidation?.academic_evaluation?.feedback && (
                          <p className="text-[10px] text-neutral-500 italic border-t border-neutral-100 pt-1">
                            «{dualValidation.academic_evaluation.feedback}»
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Enterprise Supervisor Review */}
                    <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900 flex items-center gap-1">
                          <span>🏢</span> Encadreur Entreprise
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dualValidation?.enterprise_evaluation?.approval_status === "APPROVED_FOR_DEFENSE"
                              ? "bg-emerald-100 text-emerald-800"
                              : dualValidation?.enterprise_evaluation?.approval_status === "CORRECTIONS_REQUIRED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {dualValidation?.enterprise_evaluation?.approval_status === "APPROVED_FOR_DEFENSE"
                            ? "Validé"
                            : dualValidation?.enterprise_evaluation?.approval_status === "CORRECTIONS_REQUIRED"
                            ? "Corrections requises"
                            : "En attente"}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600 space-y-1 pt-1">
                        <div className="flex justify-between">
                          <span>Note attribuée :</span>
                          <strong className="text-neutral-800">
                            {dualValidation?.enterprise_evaluation?.grade !== undefined
                              ? `${dualValidation.enterprise_evaluation.grade.toFixed(2)} / 20`
                              : "-- / 20"}
                          </strong>
                        </div>
                        {dualValidation?.enterprise_evaluation?.feedback && (
                          <p className="text-[10px] text-neutral-500 italic border-t border-neutral-100 pt-1">
                            «{dualValidation.enterprise_evaluation.feedback}»
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        fullWidth
                        variant="secondary"
                        size="sm"
                        onClick={downloadEvaluationPdf}
                        disabled={isExportingPdf || (!dualValidation?.academic_evaluation && !dualValidation?.enterprise_evaluation)}
                      >
                        {isExportingPdf ? "Génération..." : "📄 Télécharger le PV officiel PDF"}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Tab 3: Evaluation & Note */}
              {activeReviewTab === "evaluation" && (
                <Card padded={false} className="shadow-sm">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
                    <div>
                      <h2 className="font-semibold font-display text-neutral-800 text-sm">
                        {isEnterprise ? "🏢 Évaluation Entreprise" : "🏛️ Évaluation Académique"}
                      </h2>
                      {evaluation && (
                        <p className="text-[10px] text-neutral-400 font-body mt-0.5">
                          Sauvegardé le {formatDate(evaluation.updated_at)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isEnterprise ? "bg-teal-100 text-teal-800" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isEnterprise ? "Entreprise" : "Académique"}
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5">
                    {/* Role criteria sliders */}
                    <div className="bg-neutral-50/70 p-3 rounded-lg border border-neutral-200 space-y-2.5">
                      <p className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider">
                        Critères {isEnterprise ? "industriels" : "académiques"}
                      </p>
                      {isEnterprise ? (
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-[11px] text-neutral-600 flex justify-between">
                              <span>Réalisation technique & Code</span>
                              <span className="font-bold text-teal-700">{criteriaScores["tech"] || "--"}/20</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={criteriaScores["tech"] || 10}
                              onChange={(e) => setCriteriaScores((prev) => ({ ...prev, tech: Number(e.target.value) }))}
                              className="w-full accent-teal-600 cursor-pointer"
                              disabled={!history}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-neutral-600 flex justify-between">
                              <span>Autonomie & Rigueur professionnelle</span>
                              <span className="font-bold text-teal-700">{criteriaScores["autonomy"] || "--"}/20</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={criteriaScores["autonomy"] || 10}
                              onChange={(e) => setCriteriaScores((prev) => ({ ...prev, autonomy: Number(e.target.value) }))}
                              className="w-full accent-teal-600 cursor-pointer"
                              disabled={!history}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-[11px] text-neutral-600 flex justify-between">
                              <span>Méthodologie & État de l'art</span>
                              <span className="font-bold text-blue-700">{criteriaScores["methodology"] || "--"}/20</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={criteriaScores["methodology"] || 10}
                              onChange={(e) => setCriteriaScores((prev) => ({ ...prev, methodology: Number(e.target.value) }))}
                              className="w-full accent-blue-600 cursor-pointer"
                              disabled={!history}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-neutral-600 flex justify-between">
                              <span>Structure & Qualité rédactionnelle</span>
                              <span className="font-bold text-blue-700">{criteriaScores["structure"] || "--"}/20</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={criteriaScores["structure"] || 10}
                              onChange={(e) => setCriteriaScores((prev) => ({ ...prev, structure: Number(e.target.value) }))}
                              className="w-full accent-blue-600 cursor-pointer"
                              disabled={!history}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Note / 20 */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 font-body mb-1">
                        Note finale attribuée / 20
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          placeholder="0 – 20"
                          className="w-24 text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 font-semibold"
                          disabled={!history}
                        />
                        {evaluation && (
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-primary-700 font-display">
                              {evaluation.grade.toFixed(2)}
                            </span>
                            <span className="text-xs text-neutral-400 font-body">/ 20</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Decision dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 font-body mb-1">
                        Décision de soutenance (Statut)
                      </label>
                      <select
                        value={approvalStatus}
                        onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}
                        className="w-full text-xs font-body border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 font-medium cursor-pointer"
                        disabled={!history}
                      >
                        <option value="PENDING_REVIEW">En attente d'évaluation</option>
                        <option value="CORRECTIONS_REQUIRED">Corrections requises</option>
                        <option value="APPROVED_FOR_DEFENSE">Approuvé pour la soutenance</option>
                        <option value="REJECTED">Rejeté</option>
                      </select>
                    </div>

                    {/* General Feedback */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 font-body mb-1">
                        Commentaire général & Recommandations
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Remarques académiques ou techniques, points à corriger pour le jury…"
                        rows={3}
                        className="w-full text-xs font-body border border-neutral-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 leading-relaxed"
                        disabled={!history}
                      />
                    </div>

                    {evalNotice && (
                      <p
                        className={`text-xs font-body rounded px-2.5 py-1.5 ${
                          evalNotice.startsWith("✅")
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {evalNotice}
                      </p>
                    )}

                    <div className="space-y-2 pt-1">
                      <Button
                        fullWidth
                        size="sm"
                        onClick={saveEvaluation}
                        disabled={!history || isSavingEval || !grade}
                      >
                        {isSavingEval ? "Enregistrement…" : evaluation ? "Mettre à jour l'évaluation" : "Sauvegarder l'évaluation"}
                      </Button>

                      {evaluation && (
                        <>
                          <Button
                            fullWidth
                            variant="secondary"
                            size="sm"
                            onClick={downloadEvaluationPdf}
                            disabled={isExportingPdf}
                          >
                            {isExportingPdf ? "Génération PDF..." : "📄 Télécharger le Procès-Verbal PDF"}
                          </Button>
                          <Button
                            fullWidth
                            variant="primary"
                            size="sm"
                            icon={<IconAward size={15} />}
                            onClick={() => setSupervisorTab("certificate")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            Émettre le Certificat de Dépôt Officiel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* AI Analysis shortcut */}
              <div className="flex justify-end pt-1">
                <Button
                  variant="ai"
                  size="sm"
                  icon={<IconSparkles size={14} />}
                  onClick={() => onNavigate && onNavigate("workshop")}
                  disabled={!history}
                >
                  Voir l'analyse IA
                </Button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </AppShell>
  )
}
