import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import {
  IconReport, IconSparkles, IconBell, IconUser, IconAward, IconStats,
  IconUpload, IconCheck, IconAlertTriangle, IconDownload, IconChevronRight,
  IconShield, IconStudent, IconRefresh
} from "../../components/ui/Icons"
import {
  api,
  type User,
  type UniversityProfile,
  type ComplianceReport,
  type ComplianceIssue,
  type ComplianceSeverity,
  type ComplianceCategory,
  type SmartFixResult,
} from "../../lib/api"
import { getNavItems } from "../../lib/navItems"

type Tab = "upload" | "results"

// ── Helper Constants ─────────────────────────────────────────────
const CATEGORY_LABELS: Record<ComplianceCategory, { label: string; icon: string }> = {
  TYPOGRAPHY: { label: "Typographie", icon: "Aa" },
  MARGINS_SPACING: { label: "Marges & Interligne", icon: "⬜" },
  HEADINGS: { label: "Titres & Alignement", icon: "H" },
  FIGURES_TABLES: { label: "Figures & Tableaux", icon: "🖼" },
  TOC_PAGINATION: { label: "Sommaire & Pagination", icon: "📑" },
  STRUCTURE_SEMANTIC: { label: "Structure du Document", icon: "📄" },
}

const SEVERITY_META: Record<ComplianceSeverity, { label: string; color: string; bg: string; ring: string }> = {
  ERROR: { label: "Erreur", color: "text-red-700", bg: "bg-red-50", ring: "ring-red-200" },
  WARNING: { label: "Avertissement", color: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" },
  INFO: { label: "Info", color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-200" },
}

const COMPLIANCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CONFORME: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Conforme" },
  CONFORME_AVEC_RESERVES: { bg: "bg-amber-50", text: "text-amber-700", label: "Conforme avec Reserves" },
  NON_CONFORME: { bg: "bg-red-50", text: "text-red-700", label: "Non Conforme" },
}

// ── Score Ring SVG ───────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 85 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626"
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-1000 ease-out"
      />
      <text
        x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="fill-neutral-800 font-display font-bold" fontSize={size * 0.26}
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {Math.round(score)}%
      </text>
    </svg>
  )
}

// ── Category Mini-Bar ────────────────────────────────────────────
function CategoryBar({ label, icon, score, status, issuesCount, onClick, isSelected }: {
  label: string; icon: string; score: number; status: string; issuesCount: number
  onClick: () => void; isSelected: boolean
}) {
  const barColor = status === "PASS" ? "bg-emerald-500" : status === "WARNING" ? "bg-amber-400" : "bg-red-500"
  const borderClass = isSelected ? "ring-2 ring-primary-400 border-primary-400" : "hover:border-neutral-300"
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border border-neutral-200 transition-all cursor-pointer ${borderClass}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-neutral-700 font-body">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {issuesCount > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              status === "FAIL" ? "bg-red-100 text-red-700"
              : status === "WARNING" ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
            }`}>{issuesCount}</span>
          )}
          <span className="text-sm font-semibold text-neutral-800">{Math.round(score)}%</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </button>
  )
}

// ── Issue Row ────────────────────────────────────────────────────
function IssueRow({ issue, isExpanded, onToggle }: { issue: ComplianceIssue; isExpanded: boolean; onToggle: () => void }) {
  const sev = SEVERITY_META[issue.severity]
  return (
    <div className={`border rounded-xl transition-all ${isExpanded ? "border-neutral-300 shadow-sm" : "border-neutral-200"}`}>
      <button onClick={onToggle} className="w-full text-left p-4 flex items-start gap-3 cursor-pointer">
        <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${sev.bg} ring-1 ${sev.ring}`}>
          {issue.severity === "ERROR"
            ? <span className="text-red-600 text-xs font-bold">!</span>
            : issue.severity === "WARNING"
            ? <span className="text-amber-500 text-xs font-bold">!</span>
            : <IconCheck size={12} className="text-blue-600" />
          }
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>{sev.label}</span>
            {issue.fixable_by_smart_fix && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">Corrigible auto</span>
            )}
            {issue.pages.length > 0 && (
              <span className="text-xs text-neutral-400">
                p. {issue.pages.slice(0, 4).join(", ")}{issue.pages.length > 4 ? "..." : ""}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-neutral-800 mt-1 font-body">{issue.title}</p>
          {!isExpanded && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{issue.message}</p>}
        </div>
        <IconChevronRight size={16} className={`text-neutral-400 transition-transform mt-1 ${isExpanded ? "rotate-90" : ""}`} />
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-neutral-100 mx-4 mt-0">
          <p className="text-sm text-neutral-600 mt-3">{issue.message}</p>
          {(issue.expected || issue.found) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {issue.expected && (
                <div className="bg-emerald-50 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-emerald-700 block mb-0.5">Attendu</span>
                  <span className="text-sm text-emerald-800">{issue.expected}</span>
                </div>
              )}
              {issue.found && (
                <div className="bg-red-50 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-red-700 block mb-0.5">Trouve</span>
                  <span className="text-sm text-red-800">{issue.found}</span>
                </div>
              )}
            </div>
          )}
          <div className="bg-primary-50 rounded-lg p-3">
            <span className="text-xs font-semibold text-primary-700 block mb-1">Suggestion de correction</span>
            <p className="text-sm text-primary-900">{issue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Progress Steps ───────────────────────────────────────────────
function ProgressSteps({ step }: { step: number }) {
  const steps = ["Universite", "Document", "Analyse", "Resultats"]
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            i < step ? "bg-emerald-100 text-emerald-700" : i === step ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-400"
          }`}>
            {i < step ? <IconCheck size={12} /> : <span className="w-4 text-center">{i + 1}</span>}
            <span>{label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i < step ? "bg-emerald-300" : "bg-neutral-200"}`} />}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function ComplianceCheckerPage({
  onExit,
  onNavigate,
  user,
}: {
  onExit: () => void
  onNavigate?: (key: string) => void
  user?: User | null
}) {
  const [activeTab, setActiveTab] = useState<Tab>("upload")
  const [profiles, setProfiles] = useState<UniversityProfile[]>([])
  const [selectedUni, setSelectedUni] = useState<string>("INSAT")
  const [customRules, setCustomRules] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [error, setError] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<ComplianceCategory | "ALL">("ALL")
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [smartFixLoading, setSmartFixLoading] = useState(false)
  const [smartFixResult, setSmartFixResult] = useState<SmartFixResult | null>(null)
  const [docxFile, setDocxFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docxInputRef = useRef<HTMLInputElement>(null)
  const [charterFile, setCharterFile] = useState<File | null>(null)
  const [charterParsing, setCharterParsing] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Utilisateur"
  const userRole = user?.role === "ENCADRER" ? "Encadreur" : user?.role === "ADMIN" ? "Administrateur" : "Etudiant"

  const navItems = useMemo(() => getNavItems(user?.role), [user?.role])

  // ── Fetch Profiles ─────────────────────────────────────────────
  useEffect(() => {
    api.getUniversityProfiles()
      .then(setProfiles)
      .catch(() => {})
  }, [])

  // ── Run Analysis ───────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) return
    setIsAnalyzing(true)
    setError("")
    setReport(null)
    setSmartFixResult(null)
    setAnalysisProgress(10)

    const progressTimer = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 12, 88))
    }, 400)

    try {
      const result = await api.checkCompliance({
        file,
        university_id: selectedUni,
        custom_rules: customRules,
      })
      setReport(result)
      setActiveTab("results")
      setAnalysisProgress(100)
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'analyse.")
    } finally {
      clearInterval(progressTimer)
      setIsAnalyzing(false)
      setTimeout(() => setAnalysisProgress(0), 500)
    }
  }

  // ── Smart Fix ──────────────────────────────────────────────────
  const handleSmartFix = async () => {
    if (!docxFile) return
    setSmartFixLoading(true)
    try {
      const result = await api.runSmartFix({
        file: docxFile,
        university_id: selectedUni,
        custom_rules: customRules,
      })
      setSmartFixResult(result)
    } catch (e: any) {
      setError(e.message || "Erreur lors du Smart Fix.")
    } finally {
      setSmartFixLoading(false)
    }
  }

  // ── Custom Charter ─────────────────────────────────────────────
  const handleParseCharter = async () => {
    if (!charterFile) return
    setCharterParsing(true)
    try {
      const result = await api.parseCustomCharter({ file: charterFile })
      if (result.success) {
        setCustomRules(result.extracted_profile)
        setSelectedUni("CUSTOM")
        setProfiles(prev => {
          const without = prev.filter(p => p.id !== "CUSTOM")
          return [...without, result.extracted_profile]
        })
      }
    } catch (e: any) {
      setError(e.message || "Impossible de parser la charte.")
    } finally {
      setCharterParsing(false)
    }
  }

  // ── Filtered Issues ────────────────────────────────────────────
  const filteredIssues = useMemo(() => {
    if (!report) return []
    if (selectedCategory === "ALL") return report.issues
    return report.issues.filter(i => i.category === selectedCategory)
  }, [report, selectedCategory])

  const errorCount = report ? report.issues.filter(i => i.severity === "ERROR").length : 0
  const warningCount = report ? report.issues.filter(i => i.severity === "WARNING").length : 0
  const fixableCount = report ? report.stats.docx_fixable_issues_count : 0

  const currentStep = !file ? 0 : isAnalyzing ? 2 : report ? 3 : 1

  // ── Selected Profile Data ──────────────────────────────────────
  const selectedProfile = profiles.find(p => p.id === selectedUni)

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <AppShell
      navItems={navItems}
      activeKey="compliance"
      onNavigate={key => onNavigate?.(key)}
      onExit={onExit}
      userName={userName}
      userRole={userRole}
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800 font-display flex items-center gap-2">
              <IconShield size={26} />
              Conformite du Rapport
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Verifiez automatiquement la mise en forme de votre rapport PFE selon la charte officielle de votre universite.
            </p>
          </div>
          {report && (
            <Button variant="secondary" size="sm" icon={<IconRefresh size={16} />}
              onClick={() => { setReport(null); setActiveTab("upload"); setSmartFixResult(null); setError(""); setFile(null); setDocxFile(null) }}
            >
              Nouvelle analyse
            </Button>
          )}
        </div>

        {/* Progress */}
        <ProgressSteps step={currentStep} />

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <IconAlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Erreur</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer text-lg">&times;</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  UPLOAD TAB                                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeTab === "upload" && (
          <div className="space-y-5">
            {/* University Selection */}
            <Card>
              <h2 className="text-base font-bold text-neutral-800 font-display mb-3">1. Choisir la charte universitaire</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedUni(p.id); if (p.id !== "CUSTOM") setCustomRules(null) }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      selectedUni === p.id
                        ? "border-primary-500 bg-primary-50 shadow-sm"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: p.badge_color }}
                    >
                      {p.name.slice(0, 3)}
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 text-center">{p.name}</span>
                  </button>
                ))}
                {/* Custom Charter Button */}
                <button
                  onClick={() => setSelectedUni("CUSTOM")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    selectedUni === "CUSTOM"
                      ? "border-purple-500 bg-purple-50"
                      : "border-neutral-300 hover:border-purple-400 hover:bg-purple-50/50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500 text-white text-lg font-bold">+</div>
                  <span className="text-xs font-semibold text-neutral-700">Perso.</span>
                </button>
              </div>

              {/* Selected Profile Summary */}
              {selectedProfile && selectedUni !== "CUSTOM" && (
                <div className="mt-4 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: selectedProfile.badge_color }}>{selectedProfile.name.slice(0, 2)}</div>
                    <span className="text-sm font-bold text-neutral-800">{selectedProfile.full_name}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-neutral-600">
                    <div><span className="font-semibold text-neutral-700">Police :</span> {selectedProfile.body_font_families[0]} {selectedProfile.body_font_size}pt</div>
                    <div><span className="font-semibold text-neutral-700">Interligne :</span> {selectedProfile.line_spacing}</div>
                    <div><span className="font-semibold text-neutral-700">Marge G :</span> {selectedProfile.margins_cm.left} cm</div>
                    <div><span className="font-semibold text-neutral-700">Alignement :</span> Justifie</div>
                  </div>
                </div>
              )}

              {/* Custom Charter Upload */}
              {selectedUni === "CUSTOM" && (
                <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
                  <p className="text-sm text-purple-800 font-medium">
                    Telechargez le guide officiel de votre universite (PDF ou DOCX). Nos algorithmes extrairont les regles de formatage.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="file" accept=".pdf,.docx,.doc,.txt"
                      onChange={e => setCharterFile(e.target.files?.[0] ?? null)}
                      className="text-sm text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:font-medium file:cursor-pointer hover:file:bg-purple-700"
                    />
                    <Button
                      variant="primary" size="sm"
                      disabled={!charterFile || charterParsing}
                      onClick={handleParseCharter}
                    >
                      {charterParsing ? "Analyse..." : "Extraire les regles"}
                    </Button>
                  </div>
                  {customRules && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-purple-200">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><IconCheck size={14} /> Charte extraite avec succes</p>
                      <p className="text-xs text-neutral-600 mt-1">{customRules.full_name || customRules.name || "Charte personnalisee"}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* File Upload */}
            <Card>
              <h2 className="text-base font-bold text-neutral-800 font-display mb-3">2. Telecharger votre rapport PDF</h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  file ? "border-emerald-400 bg-emerald-50/30" : "border-neutral-300 hover:border-primary-400 hover:bg-primary-50/30"
                }`}
              >
                <input
                  type="file" accept=".pdf" ref={fileInputRef}
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <IconCheck size={24} className="text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-800">{file.name}</p>
                      <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} Ko - Cliquez pour changer</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <IconUpload size={36} className="mx-auto text-neutral-400 mb-3" />
                    <p className="text-sm text-neutral-600 font-medium">Cliquez ou glissez votre rapport PDF ici</p>
                    <p className="text-xs text-neutral-400 mt-1">Format accepte : PDF (max 50 Mo)</p>
                  </>
                )}
              </div>
            </Card>

            {/* Analyze Button */}
            <div className="flex justify-center">
              <Button
                variant="ai" size="lg"
                icon={isAnalyzing ? undefined : <IconSparkles size={20} />}
                disabled={!file || isAnalyzing}
                onClick={handleAnalyze}
                className="min-w-[260px]"
              >
                {isAnalyzing ? "Analyse en cours..." : "Lancer l'analyse de conformite"}
              </Button>
            </div>

            {/* Progress Bar during analysis */}
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-ai-500 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }} />
                </div>
                <p className="text-xs text-neutral-500 text-center">
                  Verification de la typographie, des marges, du sommaire, des legendes...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  RESULTS TAB                                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeTab === "results" && report && (
          <div className="space-y-5">
            {/* Executive Summary Card */}
            <Card className="!p-0 overflow-hidden">
              <div className={`px-6 py-4 ${COMPLIANCE_COLORS[report.compliance_level]?.bg || "bg-neutral-50"}`}>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <ScoreRing score={report.overall_score} />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                      <span className={`text-lg font-bold font-display ${COMPLIANCE_COLORS[report.compliance_level]?.text || "text-neutral-800"}`}>
                        {COMPLIANCE_COLORS[report.compliance_level]?.label || report.compliance_level}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">{report.summary}</p>
                    <div className="flex flex-wrap gap-3 mt-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-neutral-600 border border-neutral-200">
                        {report.stats.page_count} pages
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-neutral-600 border border-neutral-200">
                        Police: {report.stats.dominant_font} {report.stats.dominant_font_size}pt
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-neutral-600 border border-neutral-200">
                        Interligne: {report.stats.measured_line_spacing}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-neutral-600 border border-neutral-200">
                        {report.stats.detected_figures} fig. / {report.stats.detected_tables} tab.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Stats Row */}
              <div className="px-6 py-3 grid grid-cols-3 divide-x divide-neutral-200 border-t border-neutral-100">
                <div className="text-center px-3">
                  <span className="text-xl font-bold text-red-600">{errorCount}</span>
                  <p className="text-xs text-neutral-500">Erreur{errorCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center px-3">
                  <span className="text-xl font-bold text-amber-600">{warningCount}</span>
                  <p className="text-xs text-neutral-500">Avertissement{warningCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center px-3">
                  <span className="text-xl font-bold text-primary-600">{fixableCount}</span>
                  <p className="text-xs text-neutral-500">Corrigible{fixableCount !== 1 ? "s" : ""} auto</p>
                </div>
              </div>
            </Card>

            {/* Category Scores Grid */}
            <Card>
              <h2 className="text-base font-bold text-neutral-800 font-display mb-4">Resultats par categorie</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedCategory("ALL")}
                  className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedCategory === "ALL" ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <span className="text-sm font-semibold text-neutral-800">Tous les problemes</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">{report.issues.length} probleme(s)</span>
                </button>
                {Object.entries(report.category_scores).map(([catKey, score]) => {
                  const cat = catKey as ComplianceCategory
                  const meta = CATEGORY_LABELS[cat]
                  if (!meta) return null
                  return (
                    <CategoryBar
                      key={cat}
                      label={meta.label}
                      icon={meta.icon}
                      score={score.score}
                      status={score.status}
                      issuesCount={score.issues_count}
                      onClick={() => setSelectedCategory(cat)}
                      isSelected={selectedCategory === cat}
                    />
                  )
                })}
              </div>
            </Card>

            {/* Issues List */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-neutral-800 font-display">
                  {selectedCategory === "ALL" ? "Tous les problemes" : CATEGORY_LABELS[selectedCategory]?.label}
                  <span className="text-neutral-400 font-normal ml-2">({filteredIssues.length})</span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Erreur</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Avertissement</span>
                </div>
              </div>
              {filteredIssues.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <IconCheck size={32} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700">Aucun probleme dans cette categorie.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredIssues.map(issue => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      isExpanded={expandedIssue === issue.id}
                      onToggle={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Smart Fix Section */}
            {report.can_smart_fix_docx && fixableCount > 0 && (
              <Card className="border-primary-200 bg-gradient-to-r from-primary-50/50 to-ai-50/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <IconSparkles size={24} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-neutral-800 font-display">Smart Fix DOCX</h3>
                    <p className="text-sm text-neutral-600 mt-0.5">
                      Corrigez automatiquement <span className="font-semibold text-primary-700">{fixableCount} probleme(s)</span> detecte(s)
                      dans votre fichier Word. Les marges, la police, l'interligne et l'alignement seront normalises selon la charte de{" "}
                      <span className="font-semibold">{report.university_name}</span>, sans alterer vos images, tableaux ou references.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div
                    onClick={() => docxInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                      docxFile ? "border-emerald-400 bg-emerald-50/30" : "border-primary-300 hover:border-primary-500 hover:bg-white"
                    }`}
                  >
                    <input
                      type="file" accept=".docx" ref={docxInputRef}
                      onChange={e => setDocxFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    {docxFile ? (
                      <p className="text-sm text-emerald-800 font-medium flex items-center justify-center gap-2">
                        <IconCheck size={16} /> {docxFile.name}
                      </p>
                    ) : (
                      <p className="text-sm text-neutral-500">Cliquez pour uploader votre fichier DOCX source</p>
                    )}
                  </div>
                  <Button
                    variant="ai" size="md"
                    icon={<IconSparkles size={18} />}
                    disabled={!docxFile || smartFixLoading}
                    onClick={handleSmartFix}
                    className="whitespace-nowrap"
                  >
                    {smartFixLoading ? "Correction..." : "Appliquer Smart Fix"}
                  </Button>
                </div>

                {/* Smart Fix Result */}
                {smartFixResult && smartFixResult.success && (
                  <div className="mt-4 p-4 bg-white rounded-xl border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <IconCheck size={20} className="text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-800">{smartFixResult.message}</span>
                    </div>
                    <ul className="space-y-1.5 pl-7">
                      {smartFixResult.fixes_summary.map((fix, i) => (
                        <li key={i} className="text-xs text-neutral-600 list-disc">{fix}</li>
                      ))}
                    </ul>
                    <Button
                      variant="primary" size="sm"
                      icon={<IconDownload size={16} />}
                      onClick={() => {
                        const url = api.getFixedDocxDownloadUrl(smartFixResult.download_url)
                        window.open(url, "_blank")
                      }}
                    >
                      Telecharger {smartFixResult.file_name}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
