import { useEffect, useMemo, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { IconReport, IconStudent, IconBell, IconSparkles, IconUpload } from "../../components/ui/Icons"
import { api, type Annotation, type Project, type ReportHistory, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "students", label: "Mes etudiants", icon: <IconStudent size={18} /> },
  { key: "reports", label: "Rapports", icon: <IconReport size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

const pages = Array.from({ length: 32 }, (_, i) => i + 1)

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

export function ReportReviewer({ onExit, user }: { onExit: () => void; user?: User | null }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [project, setProject] = useState<Project | null>(null)
  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [draft, setDraft] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Encadreur"
  const selectedVersion = useMemo(
    () => history?.versions.find((version) => version.version_number === versionNumber),
    [history, versionNumber],
  )
  const visibleAnnotations = annotations.filter((annotation) => annotation.page_number === currentPage)
  const annotatedPages = useMemo(
    () => new Set(annotations.map((annotation) => annotation.page_number)),
    [annotations],
  )

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!user) return
      setIsLoading(true)
      setNotice("")
      try {
        const [projectData, historyData] = await Promise.all([
          api.getMyProject().catch(() => null),
          api.getReportHistory().catch(() => null),
        ])
        if (!isMounted) return
        setProject(projectData)
        setHistory(historyData)
        setVersionNumber(historyData?.current_version || 1)
        if (!projectData) setNotice("Aucun projet assigne pour le moment.")
        else if (!historyData) setNotice("Aucun rapport depose par cet etudiant.")
      } catch (err) {
        if (isMounted) setNotice(err instanceof Error ? err.message : "Impossible de charger le rapport.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    let isMounted = true

    const loadAnnotations = async () => {
      if (!history) return
      try {
        const data = await api.getAnnotations(history.id, versionNumber)
        if (isMounted) setAnnotations(data)
      } catch (err) {
        if (isMounted) setNotice(err instanceof Error ? err.message : "Impossible de charger les annotations.")
      }
    }

    loadAnnotations()
    return () => {
      isMounted = false
    }
  }, [history, versionNumber])

  const submitAnnotation = async () => {
    if (!draft.trim() || !history) return
    setIsSubmitting(true)
    setNotice("")
    try {
      const annotation = await api.createAnnotation(history.id, versionNumber, currentPage, draft.trim())
      setAnnotations((prev) => [...prev, annotation])
      setDraft("")
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Annotation impossible.")
    } finally {
      setIsSubmitting(false)
    }
  }

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
      activeKey="reports"
      onNavigate={() => {}}
      onExit={onExit}
      userName={userName}
      userRole="Encadreur"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-display text-neutral-900">
              {project?.title ?? "Rapport etudiant"}
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1 flex items-center gap-2">
              {project?.description || "Projet associe a votre compte"} <StatusBadge variant={statusToBadge(selectedVersion?.ai_analysis_status)} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={versionNumber}
              onChange={(event) => setVersionNumber(Number(event.target.value))}
              className="text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 text-neutral-700"
              disabled={!history}
            >
              {(history?.versions ?? []).map((version) => (
                <option key={version.version_number} value={version.version_number}>
                  Version {version.version_number} - {formatDate(version.uploaded_at)}
                </option>
              ))}
              {!history && <option>Pas de version</option>}
            </select>
            <Button variant="secondary" size="sm" icon={<IconUpload size={14} />} onClick={downloadVersion} disabled={!history}>
              Telecharger
            </Button>
          </div>
        </div>

        {notice && (
          <p className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-body">
            {notice}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {"<-"}
                </button>
                <span className="text-sm font-body text-neutral-600">
                  Page {currentPage} / {pages.length}
                </span>
                <button
                  className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  onClick={() => setCurrentPage((p) => Math.min(pages.length, p + 1))}
                  disabled={currentPage === pages.length}
                >
                  {"->"}
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm font-body text-neutral-500">
                <span>{isLoading ? "Chargement..." : selectedVersion?.original_file_name ?? "Aucun fichier"}</span>
              </div>
            </div>

            <div className="bg-neutral-100 py-8 flex justify-center">
              <div className="bg-white shadow-sm w-[440px] aspect-[210/297] rounded-sm p-8 text-xs text-neutral-300 font-body leading-relaxed">
                <p className="text-neutral-500 font-semibold mb-2">Apercu du rapport</p>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="h-2 bg-neutral-100 rounded mb-2" style={{ width: `${90 - (i % 4) * 10}%` }} />
                ))}
              </div>
            </div>

            <div className="flex gap-1 px-4 py-3 border-t border-neutral-200 overflow-x-auto">
              {pages.map((p) => (
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
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-ai-600" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Card padded={false} className="flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-200">
              <h2 className="font-semibold font-display text-neutral-800 text-sm">
                Annotations - page {currentPage}
              </h2>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-[240px]">
              {visibleAnnotations.length === 0 && (
                <p className="text-sm text-neutral-400 font-body">Aucune annotation sur cette page.</p>
              )}
              {visibleAnnotations.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <Avatar name={userName} size="sm" />
                  <div>
                    <p className="text-xs text-neutral-400 font-body">{formatDate(a.created_at)}</p>
                    <p className="text-sm text-neutral-700 font-body leading-relaxed">{a.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-200">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ajouter une annotation sur cette page..."
                rows={3}
                className="w-full text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                disabled={!history}
              />
              <Button fullWidth size="sm" className="mt-2" onClick={submitAnnotation} disabled={!history || isSubmitting}>
                {isSubmitting ? "Ajout..." : "Ajouter le commentaire"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="ai" size="sm" icon={<IconSparkles size={14} />} disabled={!history}>
            Voir l'analyse IA de cette version
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
