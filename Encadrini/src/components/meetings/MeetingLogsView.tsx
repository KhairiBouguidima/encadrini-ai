import { useEffect, useState, useMemo } from "react"
import { Card, Avatar, Input } from "../ui/Primitives"
import { Button } from "../ui/Button"
import {
  IconCalendar,
  IconCheck,
  IconPlus,
  IconClock,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconUser,
  IconShield,
  IconClose,
  IconLock,
} from "../ui/Icons"
import {
  api,
  type MeetingLog,
  type MeetingLogStatus,
  type User,
  type Project,
  type SupervisorRole,
} from "../../lib/api"
import { useToast } from "../ui/Toast"

interface MeetingLogsViewProps {
  project: Project
  currentUser: User | null
  onBack?: () => void
}

function statusBadge(status: MeetingLogStatus) {
  switch (status) {
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <IconCheck size={12} className="text-emerald-600" />
          Validé & Archivé
        </span>
      )
    case "CHANGES_REQUESTED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <IconAlertTriangle size={12} className="text-amber-600" />
          Corrections requises
        </span>
      )
    case "SUBMITTED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <IconClock size={12} className="text-blue-600" />
          En attente de revue
        </span>
      )
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
          <IconEdit size={12} className="text-neutral-500" />
          Brouillon
        </span>
      )
  }
}

function formatDate(iso: string) {
  if (!iso) return "-"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  if (!iso) return "-"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MeetingLogsView({ project, currentUser, onBack }: MeetingLogsViewProps) {
  const { toast, confirm } = useToast()

  const [logs, setLogs] = useState<MeetingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formWork, setFormWork] = useState("")
  const [formBlockers, setFormBlockers] = useState("")
  const [formSupervisorFeedback, setFormSupervisorFeedback] = useState("")
  const [formObjectives, setFormObjectives] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Supervisor Review inline state
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const isSupervisorOrAdmin = useMemo(() => {
    if (!currentUser) return false
    if (currentUser.role === "ADMIN" || currentUser.role === "ENCADRER") return true
    return false
  }, [currentUser])

  const isStudent = useMemo(() => {
    return currentUser?.role === "STUDENT"
  }, [currentUser])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await api.getMeetingLogs(project.id)
      setLogs(data)
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur de chargement",
        message: err.message || "Impossible de charger les comptes-rendus.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (project?.id) {
      loadLogs()
    }
  }, [project?.id])

  const filteredLogs = useMemo(() => {
    if (statusFilter === "ALL") return logs
    return logs.filter((l) => l.status === statusFilter)
  }, [logs, statusFilter])

  const stats = useMemo(() => {
    const total = logs.length
    const approved = logs.filter((l) => l.status === "APPROVED").length
    const pending = logs.filter((l) => l.status === "SUBMITTED").length
    const changes = logs.filter((l) => l.status === "CHANGES_REQUESTED").length
    return { total, approved, pending, changes }
  }, [logs])

  const openCreateModal = () => {
    setEditingLogId(null)
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormWork("")
    setFormBlockers("")
    setFormSupervisorFeedback("")
    setFormObjectives("")
    setIsModalOpen(true)
  }

  const openEditModal = (log: MeetingLog) => {
    if (log.status === "APPROVED") {
      toast({
        variant: "warning",
        title: "Compte-rendu verrouillé",
        message: "Ce compte-rendu a été validé et ne peut plus être modifié.",
      })
      return
    }
    setEditingLogId(log.id)
    setFormDate(log.meeting_date ? log.meeting_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setFormWork(log.work_completed || "")
    setFormBlockers(log.encountered_blockers || "")
    setFormSupervisorFeedback(log.supervisor_feedback || "")
    setFormObjectives(log.next_week_objectives || "")
    setIsModalOpen(true)
  }

  const handleSaveModal = async (statusToSet: "DRAFT" | "SUBMITTED") => {
    if (!formWork.trim() || !formObjectives.trim()) {
      toast({
        variant: "error",
        title: "Champs obligatoires",
        message: "Veuillez renseigner le travail réalisé et les objectifs de la semaine suivante.",
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (editingLogId) {
        await api.updateMeetingLog(project.id, editingLogId, {
          meeting_date: new Date(formDate).toISOString(),
          work_completed: formWork,
          encountered_blockers: formBlockers,
          supervisor_feedback: formSupervisorFeedback,
          next_week_objectives: formObjectives,
          status: statusToSet,
        })
        toast({
          variant: "success",
          title: "Compte-rendu mis à jour",
          message:
            statusToSet === "SUBMITTED"
              ? "Le compte-rendu a été soumis pour révision."
              : "Brouillon sauvegardé.",
        })
      } else {
        await api.createMeetingLog(project.id, {
          meeting_date: new Date(formDate).toISOString(),
          work_completed: formWork,
          encountered_blockers: formBlockers,
          supervisor_feedback: formSupervisorFeedback,
          next_week_objectives: formObjectives,
          status: statusToSet,
        })
        toast({
          variant: "success",
          title: "Compte-rendu créé",
          message:
            statusToSet === "SUBMITTED"
              ? "Compte-rendu soumis à vos encadreurs."
              : "Compte-rendu enregistré en brouillon.",
        })
      }
      setIsModalOpen(false)
      await loadLogs()
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur",
        message: err.message || "Impossible d'enregistrer le compte-rendu.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReviewAction = async (logId: string, action: "APPROVE" | "REQUEST_CHANGES") => {
    const feedback = reviewFeedback[logId] || ""
    if (action === "REQUEST_CHANGES" && !feedback.trim()) {
      toast({
        variant: "warning",
        title: "Précision requise",
        message: "Veuillez indiquer les corrections demandées aux étudiants.",
      })
      return
    }

    setReviewingId(logId)
    try {
      await api.reviewMeetingLog(project.id, logId, {
        action,
        feedback: feedback.trim() || undefined,
      })
      toast({
        variant: "success",
        title: action === "APPROVE" ? "Compte-rendu approuvé !" : "Modifications demandées",
        message:
          action === "APPROVE"
            ? "Le compte-rendu a été validé et verrouillé dans l'historique."
            : "Les étudiants ont été notifiés des corrections à apporter.",
      })
      setReviewFeedback((prev) => ({ ...prev, [logId]: "" }))
      await loadLogs()
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur de révision",
        message: err.message || "Impossible d'enregistrer la décision.",
      })
    } finally {
      setReviewingId(null)
    }
  }

  const handleDeleteDraft = async (logId: string) => {
    const ok = await confirm({
      title: "Supprimer le brouillon ?",
      message: "Cette action supprimera définitivement ce compte-rendu non soumis.",
      confirmText: "Supprimer",
      variant: "danger",
    })
    if (!ok) return

    try {
      await api.deleteMeetingLog(project.id, logId)
      toast({
        variant: "success",
        title: "Brouillon supprimé",
      })
      await loadLogs()
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur",
        message: err.message || "Impossible de supprimer le compte-rendu.",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                <IconCalendar size={22} />
              </span>
              <div>
                <h2 className="text-xl font-bold font-heading text-neutral-900">
                  Journal de Réunions & Suivi PFE
                </h2>
                <p className="text-xs text-neutral-500 font-body">
                  Traçabilité hebdomadaire des séances de travail, blocages et validations
                  d'encadrement.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack}>
                Retour
              </Button>
            )}
            {isStudent && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={16} />}
                onClick={openCreateModal}
              >
                Nouveau compte-rendu
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-100">
          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200/60">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Total Séances
            </span>
            <div className="text-xl font-bold text-neutral-900 mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-100">
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
              Approuvés
            </span>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">{stats.approved}</div>
          </div>
          <div className="bg-blue-50/60 rounded-lg p-3 border border-blue-100">
            <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">
              En attente
            </span>
            <div className="text-xl font-bold text-blue-800 mt-0.5">{stats.pending}</div>
          </div>
          <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-100">
            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
              À corriger
            </span>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{stats.changes}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "ALL", label: `Tous (${logs.length})` },
          { key: "APPROVED", label: `Validés (${stats.approved})` },
          { key: "SUBMITTED", label: `En révision (${stats.pending})` },
          { key: "CHANGES_REQUESTED", label: `Corrections requises (${stats.changes})` },
          { key: "DRAFT", label: "Brouillons" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              statusFilter === f.key
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="p-12 text-center text-neutral-400 font-body">
          <IconClock size={28} className="animate-spin mx-auto mb-2 text-primary-500" />
          Chargement du journal des réunions...
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
              <IconCalendar size={24} />
            </div>
            <h3 className="text-base font-semibold text-neutral-800">
              Aucun compte-rendu de réunion enregistré
            </h3>
            <p className="text-xs text-neutral-500">
              {isStudent
                ? "Rédigez votre premier compte-rendu hebdomadaire pour faire valider vos avancées par vos encadreurs."
                : "Les étudiants n'ont pas encore soumis de compte-rendu dans cette catégorie."}
            </p>
            {isStudent && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={16} />}
                onClick={openCreateModal}
                className="mt-2"
              >
                Créer un compte-rendu
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const isApproved = log.status === "APPROVED"
            const isPending = log.status === "SUBMITTED"
            const isChanges = log.status === "CHANGES_REQUESTED"
            const isDraft = log.status === "DRAFT"

            return (
              <div
                key={log.id}
                className={`bg-white rounded-xl border transition-all ${
                  isApproved
                    ? "border-emerald-200 shadow-xs"
                    : isChanges
                    ? "border-amber-200 shadow-xs bg-amber-50/10"
                    : "border-neutral-200 shadow-xs"
                }`}
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-800"
                          : isChanges
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {new Date(log.meeting_date).getDate()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900 text-sm">
                          Séance du {formatDate(log.meeting_date)}
                        </span>
                        {statusBadge(log.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                        <span>Rédigé par <strong className="text-neutral-700">{log.author_name}</strong></span>
                        <span>•</span>
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Students (Draft or Changes Requested) */}
                  {isStudent && (isDraft || isChanges) && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<IconEdit size={14} />}
                        onClick={() => openEditModal(log)}
                      >
                        Modifier
                      </Button>
                      {isDraft && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<IconTrash size={14} />}
                          onClick={() => handleDeleteDraft(log.id)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Encountered Changes notice if applicable */}
                  {isChanges && log.review_feedback && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                      <IconAlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Remarques de l'encadreur ({log.reviewed_by_name}) :</strong>
                        <p className="mt-1 font-body">{log.review_feedback}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Work Completed */}
                    <div className="bg-neutral-50/70 rounded-lg p-3.5 border border-neutral-100">
                      <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Travail Réalisé & Avancement
                      </span>
                      <p className="text-xs text-neutral-600 font-body whitespace-pre-wrap leading-relaxed">
                        {log.work_completed}
                      </p>
                    </div>

                    {/* Blockers */}
                    <div className="bg-neutral-50/70 rounded-lg p-3.5 border border-neutral-100">
                      <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Points de Blocage / Difficultés
                      </span>
                      <p className="text-xs text-neutral-600 font-body whitespace-pre-wrap leading-relaxed">
                        {log.encountered_blockers || "Aucun blocage particulier signalé."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supervisor Feedback in Meeting */}
                    <div className="bg-neutral-50/70 rounded-lg p-3.5 border border-neutral-100">
                      <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Retours & Directives de la réunion
                      </span>
                      <p className="text-xs text-neutral-600 font-body whitespace-pre-wrap leading-relaxed">
                        {log.supervisor_feedback || "Pas de remarques spécifiques notées."}
                      </p>
                    </div>

                    {/* Next Week Objectives */}
                    <div className="bg-neutral-50/70 rounded-lg p-3.5 border border-neutral-100">
                      <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Objectifs de la semaine suivante
                      </span>
                      <p className="text-xs text-neutral-600 font-body whitespace-pre-wrap leading-relaxed">
                        {log.next_week_objectives}
                      </p>
                    </div>
                  </div>

                  {/* Read-Only History Seal for Approved logs */}
                  {isApproved && (
                    <div className="mt-3 p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-900">
                        <IconLock size={15} className="text-emerald-700 flex-shrink-0" />
                        <span>
                          <strong>Validé par :</strong> {log.reviewed_by_name} ({log.reviewed_by_role === "ENTERPRISE" ? "Entreprise" : "Académique"})
                          {log.reviewed_at && ` le ${formatDateTime(log.reviewed_at)}`}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        Document officiel archivé en lecture seule
                      </span>
                    </div>
                  )}

                  {/* Supervisor Review Action Bar for Pending logs */}
                  {isSupervisorOrAdmin && isPending && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 bg-neutral-50/50 p-4 rounded-lg space-y-3">
                      <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <IconShield size={14} className="text-primary-600" />
                        Évaluation de l'encadreur (One-Click Review)
                      </span>

                      <div>
                        <input
                          type="text"
                          value={reviewFeedback[log.id] || ""}
                          onChange={(e) =>
                            setReviewFeedback((prev) => ({ ...prev, [log.id]: e.target.value }))
                          }
                          placeholder="Commentaire ou remarques (obligatoire si corrections demandées)..."
                          className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-body"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<IconAlertTriangle size={14} className="text-amber-600" />}
                          onClick={() => handleReviewAction(log.id, "REQUEST_CHANGES")}
                          disabled={reviewingId === log.id}
                        >
                          Demander des corrections
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<IconCheck size={14} />}
                          onClick={() => handleReviewAction(log.id, "APPROVE")}
                          disabled={reviewingId === log.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Approuver le compte-rendu
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Create or Edit Meeting Log */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900 font-heading">
                {editingLogId ? "Modifier le compte-rendu" : "Nouveau compte-rendu de réunion"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <IconClose size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Date de la réunion <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Travail réalisé & Livrables <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formWork}
                  onChange={(e) => setFormWork(e.target.value)}
                  placeholder="Détaillez les tâches accomplies, les modules développés, la rédaction..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Points de blocage rencontrés
                </label>
                <textarea
                  rows={2}
                  value={formBlockers}
                  onChange={(e) => setFormBlockers(e.target.value)}
                  placeholder="Difficultés techniques, accès manquants, problèmes de modélisation..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Directives & Retours formulés lors de la réunion
                </label>
                <textarea
                  rows={2}
                  value={formSupervisorFeedback}
                  onChange={(e) => setFormSupervisorFeedback(e.target.value)}
                  placeholder="Recommandations et remarques exprimées par les encadreurs..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Objectifs de la semaine suivante <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  placeholder="Prochains livrables prévus, tests, chapitres à rédiger..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveModal("DRAFT")}
                  disabled={isSubmitting}
                >
                  Enregistrer Brouillon
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSaveModal("SUBMITTED")}
                  disabled={isSubmitting}
                >
                  Soumettre pour Revue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
