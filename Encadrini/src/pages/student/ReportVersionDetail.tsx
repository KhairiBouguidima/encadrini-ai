import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Tag } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconBell, IconChevronRight, IconUpload } from "../../components/ui/Icons"
import { api, type Annotation, type ReportHistory, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
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
  onExit,
  user,
}: {
  versionId?: string
  score?: number
  onBack: () => void
  onOpenWorkshop: () => void
  onExit: () => void
  user?: User | null
}) {
  const versionNumber = Number(versionId) || 3
  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [comments, setComments] = useState<Annotation[]>(sampleComments)
  const [notice, setNotice] = useState("")
  const userName = user ? `${user.first_name} ${user.last_name}` : "Karim Boumediene"

  const selectedVersion = useMemo(
    () => history?.versions.find((version) => version.version_number === versionNumber),
    [history, versionNumber],
  )

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (!user) return
      setNotice("")

      try {
        const historyData = await api.getReportHistory()
        if (!isMounted) return
        setHistory(historyData)
        const annotationData = await api.getAnnotations(historyData.id, versionNumber)
        if (isMounted) setComments(annotationData)
      } catch (err) {
        if (isMounted) setNotice(err instanceof Error ? err.message : "Donnees de demo affichees.")
      }
    }

    loadData()
    return () => {
      isMounted = false
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
      onNavigate={(key) => key === "workshop" && onOpenWorkshop()}
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

        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">
              Version {versionNumber} - Analyse IA
            </h1>
            {selectedVersion && (
              <p className="text-sm text-neutral-500 font-body mt-1">
                {selectedVersion.original_file_name} - deposee le {formatDate(selectedVersion.uploaded_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<IconUpload size={14} />} onClick={downloadVersion}>
              Telecharger
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
          <Card className="md:col-span-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full border-[6px] border-primary-100 flex items-center justify-center text-primary-700 font-bold font-display text-2xl mb-3">
              {score}
            </div>
            <p className="text-sm font-semibold font-body text-neutral-800">Score de qualite</p>
            <p className="text-xs text-neutral-500 font-body mt-1">Structure - Coherence - Style</p>
          </Card>

          <Card className="md:col-span-2">
            <h3 className="font-semibold font-display text-neutral-800 mb-2">Resume genere</h3>
            <p className="text-sm text-neutral-600 font-body leading-relaxed">
              Ce rapport propose une approche de detection d'anomalies dans le trafic reseau basee sur
              l'apprentissage automatique. Apres une revue de l'etat de l'art, l'etude compare plusieurs
              architectures de modeles avant de proposer une solution hybride evaluee sur un jeu de donnees reel.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {keywords.map((keyword) => (
                <Tag key={keyword} label={keyword} />
              ))}
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Questions de jury anticipees</h3>
            <ul className="space-y-3">
              {juryQuestions.map((question) => (
                <li key={question} className="text-sm text-neutral-600 font-body leading-relaxed pl-3 border-l-2 border-ai-200">
                  {question}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Commentaires de l'encadreur</h3>
            <div className="space-y-4">
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
