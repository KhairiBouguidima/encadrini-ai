import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Tag } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconChevronRight, IconUpload, IconBell, IconUser } from "../../components/ui/Icons"
import { api, type AIAnalysisResponse, type Annotation, type ReportHistory, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil & Encadreur", icon: <IconUser size={18} /> },
]

const keywords = ["Machine Learning", "Detection d'anomalies", "Securite reseau", "Deep Learning", "Big Data"]

const juryQuestions = [
  "Quels jeux de donnees ont servi a entrainer votre modele et sont-ils representatifs du trafic reel ?",
  "Comment votre approche se compare-t-elle aux methodes de detection par signature classiques ?",
  "Quelles sont les limites de votre modele face a des attaques inedites ?",
]

const sampleComments = [
  {
    id: "sample-1",
    report_id: "sample",
    version_number: 3,
    page_number: 12,
    author_id: "supervisor",
    content: "La methodologie gagnerait a preciser le protocole d'evaluation croisee.",
    created_at: "2026-07-19T10:00:00Z",
  },
  {
    id: "sample-2",
    report_id: "sample",
    version_number: 3,
    page_number: 24,
    author_id: "supervisor",
    content: "Bonne synthese de l'etat de l'art, pensez a citer les travaux de 2025.",
    created_at: "2026-07-19T10:00:00Z",
  },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  )
}

export function ReportVersionDetail({
  versionId = "3",
  score = 82,
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
  const versionNumber = Number(versionId) || 3
  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [comments, setComments] = useState<Annotation[]>(() => (user ? [] : sampleComments))
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [notice, setNotice] = useState("")
  const userName = user ? `${user.first_name} ${user.last_name}` : "Karim Boumediene"

  const selectedVersion = useMemo(
    () => history?.versions.find((version) => version.version_number === versionNumber),
    [history, versionNumber],
  )
  const isAnalyzing = analysis?.status === "PROCESSING" || analysis?.status === "PENDING" || (Boolean(user) && !analysis?.scores)
  const displayedScore = analysis?.scores?.overall_quality ?? (isAnalyzing ? "..." : score)
  const displayedSummary =
    analysis?.generated_content?.summary ??
    (isAnalyzing
      ? "L'intelligence artificielle analyse actuellement votre document. Les résultats s'afficheront automatiquement dans quelques secondes..."
      : user
        ? "Le résumé IA sera disponible après l'analyse."
        : "Ce rapport propose une approche de détection d'anomalies dans le trafic réseau basée sur l'apprentissage automatique.")
  const displayedKeywords = analysis?.generated_content?.keywords?.length ? analysis.generated_content.keywords : user ? [] : keywords
  const displayedQuestions = analysis?.generated_content?.jury_questions?.length
    ? analysis.generated_content.jury_questions
    : user
      ? []
      : juryQuestions

  useEffect(() => {
    let isMounted = true
    let pollInterval: any = null

    const loadData = async (silent = false) => {
      if (!user) return
      if (!silent) setNotice("")

      try {
        const historyData = await api.getReportHistory()
        if (!isMounted) return
        setHistory(historyData)
        const [annotationData, analysisData] = await Promise.all([
          api.getAnnotations(historyData.id, versionNumber).catch(() => []),
          api.getAIAnalysis(historyData.id, versionNumber).catch(() => null),
        ])
        if (isMounted) {
          setComments(annotationData)
          setAnalysis(analysisData)
        }
      } catch (err) {
        if (isMounted && !silent) setNotice(err instanceof Error ? err.message : "Données indisponibles.")
      }
    }

    loadData()

    // Poll every 3 seconds if analysis is pending or processing
    pollInterval = setInterval(() => {
      loadData(true)
    }, 3000)

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [user, versionNumber])

  const downloadVersion = async () => {
    try {
      const response = await fetch(api.getDownloadUrl(versionNumber), { headers: api.getAuthHeaders() })
      if (!response.ok) throw new Error("Telechargement impossible.")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = selectedVersion?.original_file_name ?? `rapport_v${versionNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Telechargement impossible.")
    }
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey="dashboard"
      onNavigate={(key) => {
        if (key === "dashboard") {
          onBack()
        } else if (key === "workshop") {
          onOpenWorkshop()
        } else if (onNavigate) {
          onNavigate(key)
        }
      }}
      onExit={onExit}
      userName={userName}
      userRole="Etudiant - M2 informatique"
    >
      <div className="max-w-5xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium font-body text-neutral-500 hover:text-neutral-800 transition-colors mb-6"
        >
          <IconChevronRight size={14} className="rotate-180" /> Retour au tableau de bord
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold font-display text-neutral-900">
                Version {versionNumber}
              </h1>
              <span className="px-2.5 py-1 rounded-md bg-ai-100 text-ai-700 text-xs font-semibold font-body flex items-center gap-1.5">
                <IconSparkles size={12} /> Analyse IA
              </span>
            </div>
            {selectedVersion ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-neutral-600 font-body">
                <span className="flex items-center gap-1.5">
                  <IconReport size={16} className="text-neutral-400" />
                  <span className="font-medium text-neutral-800">{selectedVersion.original_file_name}</span>
                </span>
                <span className="hidden sm:inline text-neutral-300">•</span>
                <span>Déposée le <span className="font-medium">{formatDate(selectedVersion.uploaded_at)}</span></span>
                <span className="hidden sm:inline text-neutral-300">•</span>
                <span>{(selectedVersion.file_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 font-body mt-1">Détails du fichier non disponibles.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<IconUpload size={14} />} onClick={downloadVersion}>
              Télécharger
            </Button>
            <Button variant="ai" size="sm" icon={<IconSparkles size={14} />} onClick={onOpenWorkshop}>
              Ouvrir l'Atelier IA
            </Button>
          </div>
        </div>

        {notice && (
          <p className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-body">
            {notice}
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          <Card className="md:col-span-1 flex flex-col justify-center border-t-4 border-t-primary-500">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full border-4 border-primary-100 flex items-center justify-center bg-white shadow-sm">
                <span className="text-primary-700 font-bold font-display text-xl">{displayedScore}</span>
              </div>
              <div>
                <p className="text-base font-bold font-display text-neutral-900">Score Global</p>
                <p className="text-xs text-neutral-500 font-body">Évaluation de l'IA</p>
              </div>
            </div>
            
            <div className="space-y-3 mt-2 pt-4 border-t border-neutral-100">
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-neutral-600">Structure</span>
                <span className="font-semibold text-neutral-900">{analysis?.scores?.structural ?? "-"} / 100</span>
              </div>
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-neutral-600">Cohérence</span>
                <span className="font-semibold text-neutral-900">{analysis?.scores?.coherence ?? "-"} / 100</span>
              </div>
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-neutral-600">Linguistique</span>
                <span className="font-semibold text-neutral-900">{analysis?.scores?.linguistic ?? "-"} / 100</span>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            <h3 className="font-semibold font-display text-neutral-800 mb-2 flex items-center gap-2">
              Résumé généré par l'IA
            </h3>
            <p className="text-sm text-neutral-600 font-body leading-relaxed flex-grow">
              {displayedSummary}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-neutral-100">
              {displayedKeywords.map((keyword) => (
                <Tag key={keyword} label={keyword} />
              ))}
              {displayedKeywords.length === 0 && (
                <p className="text-sm text-neutral-400 font-body">Aucun mot-clé généré pour le moment.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Questions de jury anticipees</h3>
            <ul className="space-y-3">
              {displayedQuestions.map((question) => (
                <li key={question} className="text-sm text-neutral-600 font-body leading-relaxed pl-3 border-l-2 border-ai-200">
                  {question}
                </li>
              ))}
            </ul>
            {displayedQuestions.length === 0 && (
              <p className="text-sm text-neutral-400 font-body">Aucune question generee pour le moment.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Commentaires de l'encadreur</h3>
            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-neutral-400 font-body">Aucun commentaire pour cette version.</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar name="Pr. Said Amrani" size="sm" />
                  <div>
                    <p className="text-xs text-neutral-400 font-body">
                      Page {comment.page_number} - {formatDate(comment.created_at)}
                    </p>
                    <p className="text-sm text-neutral-700 font-body leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
