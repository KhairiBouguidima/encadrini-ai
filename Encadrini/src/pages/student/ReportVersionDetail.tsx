import { useEffect, useMemo, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card, Avatar, Tag } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import {
  IconReport,
  IconSparkles,
  IconChevronRight,
  IconUpload,
  IconBell,
  IconUser,
  IconDownload,
  IconCheck,
  IconAward,
} from "../../components/ui/Icons"
import {
  api,
  type AIAnalysisResponse,
  type Annotation,
  type Evaluation,
  type ApprovalStatus,
  type ReportHistory,
  type User,
} from "../../lib/api"
import { useToast } from "../../components/ui/Toast"
import { STUDENT_NAV_ITEMS } from "../../lib/navItems"

const APPROVAL_CONFIG: Record<
  ApprovalStatus,
  { label: string; badge: BadgeVariant; desc: string; bg: string; text: string }
> = {
  PENDING_REVIEW: {
    label: "En attente d'évaluation",
    badge: "pending",
    desc: "Votre encadreur n'a pas encore validé cette version. Vous recevrez une notification dès sa publication.",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
  },
  CORRECTIONS_REQUIRED: {
    label: "Corrections requises",
    badge: "rejected",
    desc: "Des modifications importantes sont demandées. Consultez les annotations et déposez une nouvelle version.",
    bg: "bg-rose-50 border-rose-200",
    text: "text-rose-800",
  },
  APPROVED_FOR_DEFENSE: {
    label: "Approuvé pour la soutenance",
    badge: "analysed",
    desc: "Félicitations ! Ce rapport a été validé par votre encadreur pour être présenté devant le jury de soutenance.",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
  },
  REJECTED: {
    label: "Rejeté",
    badge: "rejected",
    desc: "Cette version a été refusée. Veuillez contacter votre encadreur universitaire pour convenir des orientations.",
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
  },
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function ReportVersionDetail({
  versionId = "1",
  onBack,
  onOpenWorkshop,
  onNavigate,
  onExit,
  user,
}: {
  versionId?: string
  score?: number
  onBack: () => void
  onOpenWorkshop: () => void
  onNavigate?: (key: string) => void
  onExit: () => void
  user?: User | null
}) {
  const versionNumber = Number(versionId) || 1
  const { toast } = useToast()

  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [comments, setComments] = useState<Annotation[]>([])
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [notice, setNotice] = useState("")

  const userName = user ? `${user.first_name} ${user.last_name}` : "Étudiant"

  const selectedVersion = useMemo(
    () => history?.versions.find((version) => version.version_number === versionNumber),
    [history, versionNumber],
  )

  const isAnalyzing =
    analysis?.status === "PROCESSING" ||
    analysis?.status === "PENDING" ||
    (!analysis?.scores && selectedVersion?.ai_analysis_status === "PROCESSING")

  const displayedScore = analysis?.scores?.overall_quality ?? (isAnalyzing ? "..." : "-")
  const displayedSummary =
    analysis?.generated_content?.summary ??
    (isAnalyzing
      ? "L'intelligence artificielle analyse actuellement votre document. Les résultats s'actualiseront automatiquement..."
      : "Le résumé généré par l'IA sera disponible une fois l'analyse terminée.")
  const displayedKeywords = analysis?.generated_content?.keywords || []
  const displayedQuestions = analysis?.generated_content?.jury_questions || []

  // Load all version data
  useEffect(() => {
    let isMounted = true
    let pollInterval: any = null

    const loadData = async (silent = false) => {
      if (!user) return
      if (!silent) {
        setIsLoading(true)
        setIsEvaluationLoading(true)
      }

      try {
        const historyData = await api.getReportHistory()
        if (!isMounted) return
        setHistory(historyData)

        const [annotationData, analysisData, evalData] = await Promise.all([
          api.getAnnotations(historyData.id, versionNumber).catch(() => []),
          api.getAIAnalysis(historyData.id, versionNumber).catch(() => null),
          api.getEvaluation(historyData.id, versionNumber).catch(() => null),
        ])

        if (isMounted) {
          setComments(annotationData)
          setAnalysis(analysisData)
          setEvaluation(evalData)
          setIsLoading(false)
          setIsEvaluationLoading(false)
        }
      } catch (err) {
        if (isMounted && !silent) {
          setNotice(err instanceof Error ? err.message : "Données indisponibles.")
          setIsLoading(false)
          setIsEvaluationLoading(false)
        }
      }
    }

    loadData()

    // Poll if AI analysis is running
    pollInterval = setInterval(() => {
      loadData(true)
    }, 4000)

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [user, versionNumber])

  // Download raw document
  const downloadVersion = async () => {
    if (!history) return
    try {
      const response = await fetch(api.getDownloadUrl(versionNumber, history.id), {
        headers: api.getAuthHeaders(),
      })
      if (!response.ok) throw new Error("Téléchargement du fichier impossible.")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = selectedVersion?.original_file_name ?? `rapport_v${versionNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Téléchargement lancé avec succès.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de téléchargement.")
    }
  }

  // Download Official Evaluation PDF
  const downloadEvaluationPdf = async () => {
    if (!history) return
    setIsDownloadingPdf(true)
    try {
      const response = await fetch(api.getEvaluationPdfUrl(history.id, versionNumber), {
        headers: api.getAuthHeaders(),
      })
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Aucune évaluation officielle enregistrée à exporter.")
        }
        throw new Error("Impossible de générer la fiche PDF.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Evaluation_Officielle_v${versionNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Fiche d'évaluation PDF téléchargée avec succès.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export PDF.")
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const approvalInfo = evaluation
    ? APPROVAL_CONFIG[evaluation.approval_status] || APPROVAL_CONFIG.PENDING_REVIEW
    : APPROVAL_CONFIG.PENDING_REVIEW

  return (
    <AppShell
      navItems={STUDENT_NAV_ITEMS}
      activeKey="reports"
      onNavigate={(key) => onNavigate && onNavigate(key)}
      onExit={onExit}
      userName={userName}
      userRole="Étudiant"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-body">
          <button
            onClick={onBack}
            className="hover:text-primary-600 transition-colors flex items-center gap-1 font-medium"
          >
            ← Retour aux rapports
          </button>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-800 font-semibold">
            {history?.title || "Rapport principal"} (Version {versionNumber})
          </span>
        </div>

        {/* ── Version Header Card ── */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold font-display text-neutral-900">
                Version {versionNumber}
              </h1>
              <StatusBadge variant={approvalInfo.badge} label={approvalInfo.label} />
              <span className="px-2.5 py-0.5 rounded-full bg-ai-50 text-ai-700 border border-ai-200 text-xs font-semibold font-body flex items-center gap-1">
                <IconSparkles size={12} /> IA Analyse
              </span>
            </div>

            {selectedVersion ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-neutral-600 font-body">
                <span className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <IconReport size={15} className="text-neutral-400" />
                  {selectedVersion.original_file_name}
                </span>
                <span className="text-neutral-300">•</span>
                <span>Déposé le {formatDate(selectedVersion.uploaded_at)}</span>
                <span className="text-neutral-300">•</span>
                <span>{(selectedVersion.file_size / 1024 / 1024).toFixed(2)} Mo</span>
              </div>
            ) : (
              <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse mt-2" />
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              icon={<IconDownload size={14} />}
              onClick={downloadVersion}
            >
              Document ({versionNumber})
            </Button>
            {evaluation && (
              <Button
                variant="secondary"
                size="sm"
                icon={<span>📄</span>}
                onClick={downloadEvaluationPdf}
                disabled={isDownloadingPdf}
              >
                {isDownloadingPdf ? "Export..." : "Fiche d'Évaluation (PDF)"}
              </Button>
            )}
            <Button
              variant="ai"
              size="sm"
              icon={<IconSparkles size={14} />}
              onClick={onOpenWorkshop}
            >
              Atelier IA
            </Button>
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-body flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="font-bold text-red-600">×</button>
          </div>
        )}

        {/* ── PRIORITY P1 & P3: Official Supervisor Evaluation Section ── */}
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-6 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                🎓
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-neutral-900 flex items-center gap-2">
                  Évaluation Officielle de l'Encadreur
                </h2>
                <p className="text-xs text-neutral-500 font-body">
                  Décision académique officielle faisant foi pour votre soutenance de PFE.
                </p>
              </div>
            </div>

            {evaluation && (
              <span className="text-xs text-neutral-400 font-body">
                Mis à jour le {formatDate(evaluation.updated_at)}
              </span>
            )}
          </div>

          {/* Loading Skeleton */}
          {isEvaluationLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
              <div className="h-32 bg-neutral-100 rounded-xl" />
              <div className="md:col-span-2 h-32 bg-neutral-100 rounded-xl" />
            </div>
          ) : evaluation ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Note officielle & Décision */}
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-body">
                  Note attribuée
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span
                    className={`text-4xl font-extrabold font-display ${
                      evaluation.grade >= 14
                        ? "text-emerald-600"
                        : evaluation.grade >= 10
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {evaluation.grade.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-neutral-400 font-body">/ 20</span>
                </div>

                <div className="w-full pt-3 border-t border-neutral-200 space-y-1">
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    Statut de validation
                  </span>
                  <div>
                    <StatusBadge variant={approvalInfo.badge} label={approvalInfo.label} />
                  </div>
                </div>
              </div>

              {/* Feedback & Recommandations de l'encadreur */}
              <div className="md:col-span-2 space-y-4">
                {/* Supervisor Identity Banner */}
                <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200/60 rounded-xl">
                  <Avatar name={evaluation.encadrer_name || "Encadreur Universitaire"} role="Encadreur" size="sm" />
                  <div className="truncate">
                    <p className="text-xs font-bold text-neutral-900 truncate">
                      {evaluation.encadrer_name || "Superviseur Assigné"}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-mono truncate">
                      {evaluation.encadrer_email || "Encadreur PFE"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 font-body">
                    Appréciation générale & Recommandations :
                  </h4>
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-800 font-body leading-relaxed whitespace-pre-line shadow-2xs">
                    {evaluation.feedback ? (
                      evaluation.feedback
                    ) : (
                      <span className="italic text-neutral-400">
                        Aucun commentaire écrit additionnel n'a été rédigé pour cette version.
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Explanation Box */}
                <div className={`p-3 rounded-xl border text-xs font-body ${approvalInfo.bg} ${approvalInfo.text}`}>
                  <p className="font-semibold mb-0.5">Instruction pour la suite :</p>
                  <p className="leading-relaxed">{approvalInfo.desc}</p>
                </div>
              </div>
            </div>
          ) : (
            /* Professional Empty State when evaluation is not yet submitted */
            <div className="py-10 px-6 text-center space-y-3 bg-neutral-50/60 border border-dashed border-neutral-200 rounded-xl">
              <span className="text-3xl">⏳</span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold font-display text-neutral-800">
                  En attente de l'évaluation de votre encadreur
                </h3>
                <p className="text-xs text-neutral-500 font-body max-w-md mx-auto leading-relaxed">
                  Votre encadreur a été notifié du dépôt de cette version. Dès qu'il aura examiné votre
                  document et saisi sa note ainsi que ses recommandations, elles apparaîtront ici.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── AI Analysis & Anticipated Questions Section ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* AI Score Box */}
          <Card className="flex flex-col justify-between border-t-4 border-t-ai-500">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-ai-50 text-ai-700 flex items-center justify-center font-bold text-xl border border-ai-200">
                  {displayedScore}
                </div>
                <div>
                  <p className="text-base font-bold font-display text-neutral-900">Score IA Global</p>
                  <p className="text-xs text-neutral-500 font-body">Analyse algorithmique</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-neutral-100 text-xs font-body">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Structure</span>
                  <span className="font-bold text-neutral-900">{analysis?.scores?.structural ?? "-"} / 100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Cohérence</span>
                  <span className="font-bold text-neutral-900">{analysis?.scores?.coherence ?? "-"} / 100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Qualité linguistique</span>
                  <span className="font-bold text-neutral-900">{analysis?.scores?.linguistic ?? "-"} / 100</span>
                </div>
              </div>
            </div>

            <Button
              variant="ai"
              size="sm"
              className="w-full mt-4 justify-center"
              onClick={onOpenWorkshop}
            >
              Consulter le rapport IA détaillé
            </Button>
          </Card>

          {/* AI Summary */}
          <Card className="md:col-span-2 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold font-display text-neutral-900 text-sm flex items-center gap-2">
                <IconSparkles size={16} className="text-ai-600" />
                Synthèse générée par l'IA
              </h3>
              <p className="text-xs text-neutral-600 font-body leading-relaxed">
                {displayedSummary}
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-100 mt-4">
              <span className="text-[11px] font-semibold text-neutral-500 block mb-2">Mots-clés extraits :</span>
              <div className="flex flex-wrap gap-1.5">
                {displayedKeywords.length > 0 ? (
                  displayedKeywords.map((kw) => <Tag key={kw} label={kw} />)
                ) : (
                  <span className="text-xs text-neutral-400 font-body italic">
                    Aucun mot-clé extrait pour le moment.
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ── PRIORITY P5: Real Annotations Author Display & Jury Questions ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Detailed Annotations */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold font-display text-neutral-900 text-sm flex items-center gap-2">
                💬 Remarques marginales de l'encadreur ({comments.length})
              </h3>
              <span className="text-[11px] text-neutral-400 font-body">Par page</span>
            </div>

            {comments.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 space-y-1">
                <p className="text-2xl">📝</p>
                <p className="text-xs font-body">Aucune annotation sur cette version pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-neutral-50 border border-neutral-200/70 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={comment.author_name || "Encadreur"}
                          role={comment.author_role || "Encadreur"}
                          size="sm"
                        />
                        <div className="truncate">
                          <p className="font-bold text-neutral-900 truncate">
                            {comment.author_name || "Encadreur"}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            Page {comment.page_number} • {formatDate(comment.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-800 text-[10px] font-bold">
                        p. {comment.page_number}
                      </span>
                    </div>

                    {comment.selected_text && (
                      <p className="text-[11px] italic text-neutral-600 bg-white p-2 rounded border border-neutral-100 leading-snug">
                        « {comment.selected_text} »
                      </p>
                    )}

                    <p className="text-neutral-800 font-body leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Anticipated Jury Questions */}
          <Card className="space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="font-bold font-display text-neutral-900 text-sm flex items-center gap-2">
                🎯 Questions de jury anticipées
              </h3>
              <p className="text-[11px] text-neutral-500 font-body">
                Questions potentielles préparées par l'IA d'après votre manuscrit.
              </p>
            </div>

            {displayedQuestions.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 space-y-1">
                <p className="text-2xl">💡</p>
                <p className="text-xs font-body">Aucune question anticipée pour le moment.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {displayedQuestions.map((q, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-neutral-700 font-body leading-relaxed p-3 bg-ai-50/50 border border-ai-100 rounded-xl flex items-start gap-2.5"
                  >
                    <span className="font-bold text-ai-600 flex-shrink-0">Q{idx + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
