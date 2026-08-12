import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { IconReport, IconSparkles, IconUpload, IconBell, IconChevronRight } from "../../components/ui/Icons"
import { api, type Project, type ReportHistory, type ReportVersion, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

const sampleVersions: ReportVersion[] = [
  {
    version_number: 3,
    original_file_name: "rapport_v3.pdf",
    original_mime_type: "application/pdf",
    file_size: 2430000,
    uploaded_at: "2026-07-18T10:00:00Z",
    ai_analysis_status: "COMPLETED",
  },
  {
    version_number: 2,
    original_file_name: "rapport_v2.pdf",
    original_mime_type: "application/pdf",
    file_size: 2290000,
    uploaded_at: "2026-07-02T10:00:00Z",
    ai_analysis_status: "COMPLETED",
  },
  {
    version_number: 1,
    original_file_name: "rapport_v1.pdf",
    original_mime_type: "application/pdf",
    file_size: 2110000,
    uploaded_at: "2026-06-20T10:00:00Z",
    ai_analysis_status: "COMPLETED",
  },
]

function statusToBadge(status: ReportVersion["ai_analysis_status"]): BadgeVariant {
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

export function StudentDashboard({
  onOpenVersion,
  onOpenWorkshop,
  onExit,
  user,
}: {
  onOpenVersion: (versionId: string) => void
  onOpenWorkshop: () => void
  onExit: () => void
  user?: User | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [history, setHistory] = useState<ReportHistory | null>(null)
  const [notice, setNotice] = useState("Mode demo: connectez-vous au backend pour charger vos donnees.")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Karim Boumediene"
  const versions = useMemo(
    () => [...(history?.versions ?? sampleVersions)].sort((a, b) => b.version_number - a.version_number),
    [history],
  )

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
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
        if (!historyData) setNotice("Aucun rapport trouve pour le moment. Deposez une premiere version.")
      } catch (err) {
        if (isMounted) {
          setNotice(err instanceof Error ? err.message : "Impossible de charger les donnees.")
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  const uploadReport = async (file: File | undefined) => {
    if (!file) return
    setIsUploading(true)
    setNotice("")

    try {
      const updatedHistory = await api.uploadReport(file)
      setHistory(updatedHistory)
      setNotice("Nouvelle version deposee. L'analyse IA demarre en arriere-plan.")
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Depot impossible pour le moment.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
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
        <div className="flex items-start justify-between mb-8 gap-6">
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">
              {project?.title ?? "Detection d'anomalies reseau par apprentissage automatique"}
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1">
              {project?.description || "Projet PFE - Genie informatique"}
            </p>
          </div>
          <Avatar name="Pr. Said Amrani" role="Encadreur associe" size="md" />
        </div>

        <Card className="mb-8">
          <h2 className="font-semibold font-display text-neutral-800 mb-4">Deposer une nouvelle version</h2>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-neutral-300 rounded-xl py-10 flex flex-col items-center justify-center text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-full bg-primary-50 flex items-center justify-center mb-3">
              <IconUpload size={20} className="text-primary-600" />
            </div>
            <p className="text-sm font-medium font-body text-neutral-700">
              {isUploading ? "Depot en cours..." : "Glissez-deposez votre fichier ici, ou cliquez pour parcourir"}
            </p>
            <p className="text-xs text-neutral-400 font-body mt-1">Formats acceptes : PDF, DOCX - 20 Mo max</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => uploadReport(event.target.files?.[0])}
          />
          {notice && (
            <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-body">
              {notice}
            </p>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 py-4 border-b border-neutral-200">
            <h2 className="font-semibold font-display text-neutral-800">
              Historique des versions {isLoading && <span className="text-xs text-neutral-400">- chargement</span>}
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {versions.map((version) => (
              <button
                key={version.version_number}
                onClick={() => onOpenVersion(String(version.version_number))}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-sm font-semibold font-display text-neutral-600">
                    v{version.version_number}
                  </div>
                  <div>
                    <p className="text-sm font-medium font-body text-neutral-800">
                      Version {version.version_number}
                    </p>
                    <p className="text-xs text-neutral-400 font-body">
                      {version.original_file_name} - deposee le {formatDate(version.uploaded_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge variant={statusToBadge(version.ai_analysis_status)} />
                  <IconChevronRight size={16} className="text-neutral-300" />
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="flex justify-end mt-6">
          <Button variant="ai" icon={<IconSparkles size={16} />} onClick={onOpenWorkshop}>
            Ouvrir l'Atelier IA
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
