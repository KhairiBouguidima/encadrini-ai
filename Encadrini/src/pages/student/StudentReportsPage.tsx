import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Input } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { 
  IconReport, IconSparkles, IconUpload, IconChevronRight, 
  IconBell, IconUser, IconPlus, IconDownload, 
  IconFileText, IconStats, IconSearch 
} from "../../components/ui/Icons"
import { api, type ReportHistory, type User } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconStats size={18} /> },
  { key: "reports", label: "Rapports PFE", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil & Encadreur", icon: <IconUser size={18} /> },
]

const REPORT_TYPES = [
  { key: "PFE", label: "Rapport PFE", color: "bg-primary-50 text-primary-700 border-primary-200" },
  { key: "CAHIER_CHARGES", label: "Cahier des charges", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "AVANCEMENT", label: "Avancement", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "INTERMEDIAIRE", label: "Intermédiaire", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "FINAL", label: "Rapport Final", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "AUTRE", label: "Autre document", color: "bg-neutral-50 text-neutral-700 border-neutral-200" },
]

function getReportTypeBadge(type: string) {
  const normalized = (type || "").replace("ReportType.", "")
  const found = REPORT_TYPES.find((t) => t.key === normalized)
  return found || { label: normalized || "Rapport", color: "bg-neutral-50 text-neutral-700 border-neutral-200" }
}

function statusToBadge(status?: string): BadgeVariant {
  if (status === "COMPLETED") return "analysed"
  if (status === "PROCESSING") return "reviewing"
  if (status === "FAILED") return "rejected"
  return "pending"
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(value),
    )
  } catch {
    return value
  }
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Ko"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function StudentReportsPage({
  onOpenVersion,
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
  const [reports, setReports] = useState<ReportHistory[]>([])
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("ALL")

  // Add Report Modal
  const [isAddReportOpen, setIsAddReportOpen] = useState(false)
  const [reportTitle, setReportTitle] = useState("")
  const [reportType, setReportType] = useState("PFE")
  const [reportDescription, setReportDescription] = useState("")
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [isCreatingReport, setIsCreatingReport] = useState(false)

  // Upload version
  const [uploadingReportId, setUploadingReportId] = useState<string | null>(null)
  const reportFileInputRef = useRef<HTMLInputElement>(null)
  const [selectedReportForUpload, setSelectedReportForUpload] = useState<string | null>(null)

  // Expanded accordions
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(new Set())

  const userName = user ? `${user.first_name} ${user.last_name}` : "Karim Boumediene"

  const toggleExpand = (id: string) => {
    setExpandedReportIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loadReports = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await api.getReports()
      setReports(data)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de chargement.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [user])

  const handleAddReport = async () => {
    if (!reportTitle.trim()) return
    setIsCreatingReport(true)
    try {
      const newRep = await api.createReport({
        title: reportTitle.trim(),
        report_type: reportType,
        description: reportDescription.trim(),
        file: reportFile || undefined,
      })
      setReports((prev) => [newRep, ...prev])
      setIsAddReportOpen(false)
      setReportTitle("")
      setReportDescription("")
      setReportFile(null)
      setNotice(`Le rapport « ${newRep.title} » a été ajouté avec succès.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur lors de la création du rapport.")
    } finally {
      setIsCreatingReport(false)
    }
  }

  const triggerVersionUpload = (reportId: string) => {
    setSelectedReportForUpload(reportId)
    reportFileInputRef.current?.click()
  }

  const handleVersionFileSelected = async (file: File | undefined) => {
    if (!file || !selectedReportForUpload) return
    setUploadingReportId(selectedReportForUpload)
    setNotice("")
    try {
      const updated = await api.uploadReportTo(selectedReportForUpload, file)
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setNotice(`Nouvelle version (${updated.current_version}) déposée pour « ${updated.title} ». Analyse IA lancée.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Échec du dépôt de la version.")
    } finally {
      setUploadingReportId(null)
      setSelectedReportForUpload(null)
      if (reportFileInputRef.current) reportFileInputRef.current.value = ""
    }
  }

  // Filter and search
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const normType = (r.report_type || "").replace("ReportType.", "")
      const matchType = filterType === "ALL" || normType === filterType
      const matchSearch =
        !searchQuery.trim() ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchType && matchSearch
    })
  }, [reports, filterType, searchQuery])

  return (
    <AppShell
      navItems={navItems}
      activeKey="reports"
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

        {/* ── HEADER DE LA PAGE RAPPORTS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-neutral-900 flex items-center gap-2.5">
              <IconFileText size={26} className="text-primary-600" />
              Rapports & Livrables PFE
              <span className="text-sm font-semibold font-body bg-primary-100 text-primary-800 px-2.5 py-0.5 rounded-full">
                {reports.length}
              </span>
              {isLoading && <span className="text-xs text-neutral-400 font-normal">Chargement...</span>}
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1">
              Déposez vos documents, suivez leurs versions successives et lancez les analyses IA.
            </p>
          </div>

          <Button
            size="md"
            icon={<IconPlus size={16} />}
            onClick={() => setIsAddReportOpen(true)}
            className="shadow-sm"
          >
            Ajouter un rapport
          </Button>
        </div>

        {/* ── FILTRES & RECHERCHE ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterType === "ALL"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Tous ({reports.length})
            </button>
            {REPORT_TYPES.map((t) => {
              const count = reports.filter((r) => (r.report_type || "").replace("ReportType.", "") === t.key).length
              if (count === 0 && filterType !== t.key) return null
              return (
                <button
                  key={t.key}
                  onClick={() => setFilterType(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    filterType === t.key
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {t.label} ({count})
                </button>
              )
            })}
          </div>

          <div className="relative min-w-[200px] md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <IconSearch size={15} />
            </div>
            <input
              type="text"
              placeholder="Rechercher un rapport..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-body focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        {/* ── LISTE DES RAPPORTS ── */}
        {filteredReports.length === 0 ? (
          <Card className="py-14 px-6 text-center border-dashed border-2 border-neutral-300">
            <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3">
              <IconUpload size={22} />
            </div>
            <h3 className="text-base font-bold font-display text-neutral-800">
              {reports.length === 0 ? "Aucun rapport déposé pour le moment" : "Aucun rapport ne correspond à votre filtre"}
            </h3>
            <p className="text-sm text-neutral-500 font-body max-w-md mx-auto mt-1 mb-5">
              {reports.length === 0
                ? "Créez votre premier rapport (ex: Cahier des charges ou Rapport d'étape) pour lancer l'analyse IA."
                : "Essayez de modifier votre recherche ou filtre."}
            </p>
            {reports.length === 0 && (
              <Button
                size="md"
                icon={<IconPlus size={16} />}
                onClick={() => setIsAddReportOpen(true)}
              >
                Ajouter mon premier rapport
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const badge = getReportTypeBadge(report.report_type)
              const latestVersion = report.versions && report.versions.length > 0 
                ? [...report.versions].sort((a, b) => b.version_number - a.version_number)[0]
                : null
              const isExpanded = expandedReportIds.has(report.id)
              const isUploadingThis = uploadingReportId === report.id

              return (
                <Card key={report.id} className="p-0 overflow-hidden border-neutral-200 transition-all hover:border-neutral-300 shadow-sm">
                  {/* Report Card Main Header */}
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                          {latestVersion && (
                            <StatusBadge variant={statusToBadge(latestVersion.ai_analysis_status)} />
                          )}
                          <span className="text-xs text-neutral-400 font-body">
                            {report.versions?.length || 0} version{report.versions?.length > 1 ? "s" : ""}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold font-display text-neutral-900 truncate">
                          {report.title}
                        </h3>

                        {report.description && (
                          <p className="text-xs text-neutral-500 font-body line-clamp-2">
                            {report.description}
                          </p>
                        )}

                        {latestVersion ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 font-body pt-1">
                            <span className="font-semibold text-neutral-700">
                              Dernière : v{latestVersion.version_number} ({latestVersion.original_file_name})
                            </span>
                            <span>•</span>
                            <span>{formatFileSize(latestVersion.file_size)}</span>
                            <span>•</span>
                            <span>Déposé le {formatDate(latestVersion.uploaded_at)}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 italic pt-1">
                            Aucun fichier déposé pour ce rapport pour le moment.
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0 pt-2 md:pt-0">
                        {/* Upload new version to this report */}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<IconUpload size={14} />}
                          disabled={isUploadingThis}
                          onClick={() => triggerVersionUpload(report.id)}
                        >
                          {isUploadingThis ? "Dépôt..." : "+ Nouvelle version"}
                        </Button>

                        {/* Open in AI Workshop */}
                        {latestVersion && (
                          <Button
                            size="sm"
                            variant="ai"
                            icon={<IconSparkles size={14} />}
                            onClick={() => onOpenWorkshop(report.id, String(latestVersion.version_number))}
                          >
                            Atelier IA
                          </Button>
                        )}

                        {/* Download latest version */}
                        {latestVersion && (
                          <a
                            href={api.getDownloadUrl(latestVersion.version_number, report.id)}
                            download
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 transition"
                            title="Télécharger la dernière version"
                          >
                            <IconDownload size={15} />
                          </a>
                        )}

                        {/* Toggle versions view */}
                        <button
                          onClick={() => toggleExpand(report.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
                        >
                          <span>Versions</span>
                          <IconChevronRight size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Versions History */}
                  {isExpanded && (
                    <div className="bg-neutral-50/70 border-t border-neutral-100 px-5 py-4 space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-display mb-2">
                        Historique complet des versions
                      </h4>
                      {(!report.versions || report.versions.length === 0) ? (
                        <p className="text-xs text-neutral-500 italic">Aucune version disponible.</p>
                      ) : (
                        [...report.versions].sort((a, b) => b.version_number - a.version_number).map((ver) => (
                          <div
                            key={ver.version_number}
                            className="flex items-center justify-between p-3 rounded-lg bg-white border border-neutral-200 text-xs hover:border-primary-300 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-neutral-700 font-display">
                                v{ver.version_number}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-800">{ver.original_file_name}</p>
                                <p className="text-neutral-400">
                                  {formatFileSize(ver.file_size)} • {formatDate(ver.uploaded_at)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <StatusBadge variant={statusToBadge(ver.ai_analysis_status)} />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onOpenVersion(report.id, String(ver.version_number))}
                              >
                                Détails
                              </Button>
                              <a
                                href={api.getDownloadUrl(ver.version_number, report.id)}
                                download
                                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                                title="Télécharger"
                              >
                                <IconDownload size={14} />
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Hidden File Input for version upload */}
        <input
          ref={reportFileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleVersionFileSelected(e.target.files?.[0])}
        />

        {/* ── MODAL: AJOUTER UN RAPPORT ── */}
        {isAddReportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                    <IconPlus size={18} />
                  </div>
                  <h3 className="text-base font-bold font-display text-neutral-900">Ajouter un nouveau rapport</h3>
                </div>
                <button
                  onClick={() => setIsAddReportOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <Input
                  label="Titre du document *"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Ex : Rapport d'avancement - Chapitre 2"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                    Type de rapport *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {REPORT_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setReportType(t.key)}
                        className={`text-xs font-semibold p-2.5 rounded-lg border text-center transition ${
                          reportType === t.key
                            ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                            : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Description courte / Objectifs du livrable"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Ex : Présente l'état de l'art et les spécifications d'architecture..."
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                    Document initial (Optionnel)
                  </label>
                  <label className="border-2 border-dashed border-neutral-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/20 transition">
                    <IconUpload size={20} className="text-neutral-400 mb-1" />
                    <span className="text-xs font-medium text-neutral-700">
                      {reportFile ? reportFile.name : "Cliquez pour sélectionner un fichier PDF ou DOCX"}
                    </span>
                    <span className="text-[11px] text-neutral-400 mt-0.5">20 Mo maximum</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <Button variant="secondary" size="md" onClick={() => setIsAddReportOpen(false)}>
                  Annuler
                </Button>
                <Button
                  size="md"
                  disabled={isCreatingReport || !reportTitle.trim()}
                  onClick={handleAddReport}
                >
                  {isCreatingReport ? "Création en cours..." : "Créer le rapport"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
