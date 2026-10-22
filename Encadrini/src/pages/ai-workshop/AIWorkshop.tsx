import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconSend, IconCheck, IconBell, IconUser, IconAward, IconStats, IconStudent } from "../../components/ui/Icons"
import { api, type AIAnalysisResponse, type User } from "../../lib/api"
import { getNavItems } from "../../lib/navItems"

type Tab = "analyse" | "chat" | "checker"
type ChatMsg = { role: "user" | "assistant"; content: string }

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score <= 30 ? "bg-success-100 text-success-700 border-success-200"
    : score <= 60 ? "bg-warning-100 text-warning-700 border-warning-200"
    : "bg-danger-100 text-danger-700 border-danger-200"
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
      {score}% IA — {label}
    </span>
  )
}

export function AIWorkshop({
  onExit,
  onNavigate,
  reportId,
  versionNumber,
  user,
}: {
  onExit: () => void
  onNavigate?: (key: string) => void
  reportId: string
  versionNumber: number
  user?: User | null
}) {
  const [activeTab, setActiveTab] = useState<Tab>("analyse")
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: `Bonjour ${user?.first_name || ""} ! 👋 Je suis votre assistant Encadrini IA. Je connais votre rapport et je suis là pour vous aider à l'améliorer. Posez-moi n'importe quelle question sur votre PFE !`,
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Checker AI state
  const [checkerText, setCheckerText] = useState("")
  const [checkerResult, setCheckerResult] = useState<{ ai_score: number; label: string; rewritten: string | null } | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [showRewritten, setShowRewritten] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Utilisateur"
  const userRole = user?.role === "ENCADRER" ? "Encadreur" : user?.role === "ADMIN" ? "Administrateur" : "Etudiant"

  const navItems = useMemo(() => getNavItems(user?.role), [user?.role])

  useEffect(() => {
    let isMounted = true
    const fetchAnalysis = async () => {
      if (!reportId || !versionNumber) { setIsLoading(false); return }
      setIsLoading(true)
      try {
        const data = await api.getAIAnalysis(reportId, versionNumber)
        if (isMounted) setAnalysis(data)
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : "Erreur de chargement.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchAnalysis()
    return () => { isMounted = false }
  }, [reportId, versionNumber])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text || isChatLoading) return

    const newMessages: ChatMsg[] = [...chatMessages, { role: "user", content: text }]
    setChatMessages(newMessages)
    setChatInput("")
    setIsChatLoading(true)

    try {
      const res = await api.chatWithAgent(
        reportId || "none",
        versionNumber || 1,
        newMessages.map((m) => ({ role: m.role, content: m.content }))
      )
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.reply }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Désolé, je n'ai pas pu traiter votre message. Réessayez dans un instant." },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  const runAICheck = async () => {
    if (!checkerText.trim() || isChecking) return
    setIsChecking(true)
    setCheckerResult(null)
    setShowRewritten(false)
    try {
      const result = await api.checkAIContent(checkerText)
      setCheckerResult(result)
    } catch {
      setCheckerResult(null)
    } finally {
      setIsChecking(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "analyse", label: "Analyse IA", icon: <IconSparkles size={14} /> },
    { key: "chat", label: "Chat avec l'Agent", icon: <IconSend size={14} /> },
    { key: "checker", label: "Checker IA", icon: <IconCheck size={14} /> },
  ]

  return (
    <AppShell
      navItems={navItems}
      activeKey="workshop"
      onNavigate={(key) => onNavigate && onNavigate(key)}
      onExit={onExit}
      userName={userName}
      userRole={userRole}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display text-neutral-900 flex items-center gap-2">
            <IconSparkles size={22} className="text-ai-600" />
            Atelier IA
          </h1>
          <p className="text-sm text-neutral-500 font-body mt-1">Version {versionNumber}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-body transition-all ${
                activeTab === tab.key
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── TAB: ANALYSE ─── */}
        {activeTab === "analyse" && (
          <>
            {isLoading && (
              <p className="text-sm text-neutral-500 animate-pulse">Chargement de l'analyse…</p>
            )}
            {error && <p className="text-sm text-danger-600">{error}</p>}

            {analysis && analysis.status === "COMPLETED" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
                <div className="space-y-5">
                  {/* Readiness Score Card (PFE Guide 5-Dimension Index) */}
                  <Card className="bg-gradient-to-br from-white via-primary-50/20 to-ai-50/30 border-primary-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold font-display text-neutral-900 text-lg">Indice de Maturité (Readiness Score)</h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary-100 text-primary-800 border border-primary-200">
                            PFE Guide Spec v1.0
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 font-body mt-1">
                          Évaluation globale agrégée sur 5 dimensions pondérées du rapport PFE.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-3xl font-extrabold font-display text-primary-700">
                            {analysis.readiness_score ?? analysis.scores?.overall_quality ?? 0}/100
                          </div>
                          <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            (analysis.readiness_score ?? 0) >= 90
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : (analysis.readiness_score ?? 0) >= 75
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : (analysis.readiness_score ?? 0) >= 60
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-rose-100 text-rose-800 border-rose-300"
                          }`}>
                            {analysis.readiness_level || "Satisfaisant"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5 Dimensions Breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider font-display">
                        Évaluation par dimension (Guide PFE)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: "structure", label: "Structure & Complétude", weight: "25%", val: analysis.dimension_scores?.structure ?? analysis.scores?.structural ?? 70 },
                          { key: "methodology", label: "Méthodologie & Problématique", weight: "25%", val: analysis.dimension_scores?.methodology ?? analysis.scores?.coherence ?? 75 },
                          { key: "language", label: "Qualité de la langue & Registre", weight: "20%", val: analysis.dimension_scores?.language ?? analysis.scores?.linguistic ?? 80 },
                          { key: "formatting", label: "Mise en page & Typographie", weight: "15%", val: analysis.dimension_scores?.formatting ?? 75 },
                          { key: "citations", label: "Citations & Bibliographie", weight: "15%", val: analysis.dimension_scores?.citations ?? 70 },
                        ].map((d) => (
                          <div key={d.key} className="p-3 bg-white rounded-lg border border-neutral-200 shadow-2xs">
                            <div className="flex justify-between items-center text-xs mb-1.5 font-body">
                              <span className="font-semibold text-neutral-800">{d.label}</span>
                              <span className="text-neutral-400 text-[10px]">Poids : {d.weight}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-neutral-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    d.val >= 80 ? "bg-emerald-500" : d.val >= 65 ? "bg-blue-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, d.val))}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold font-display text-neutral-900 w-8 text-right">
                                {Math.round(d.val)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Improvement Roadmap (Feuille de Route d'Amélioration) */}
                  <Card>
                    <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="font-semibold font-display text-neutral-800 flex items-center gap-2">
                          🗺️ Feuille de Route d'Amélioration (Improvement Roadmap)
                        </h3>
                        <p className="text-xs text-neutral-500 font-body mt-0.5">
                          Actions prioritaires classées par gain estimé pour maximiser votre note de soutenance.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {analysis.roadmap && analysis.roadmap.length > 0 ? (
                        analysis.roadmap.map((act) => {
                          const priorityColor =
                            act.priority === "critical"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : act.priority === "important"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          const priorityLabel =
                            act.priority === "critical" ? "Critique" : act.priority === "important" ? "Important" : "Mineur"

                          return (
                            <div
                              key={act.id}
                              className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-white hover:border-neutral-300 transition shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-3 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                                    {priorityLabel}
                                  </span>
                                  <h4 className="text-sm font-semibold font-display text-neutral-900">{act.title}</h4>
                                </div>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-display flex-shrink-0">
                                  +{act.estimated_gain} pts
                                </span>
                              </div>
                              <p className="text-xs text-neutral-600 font-body mb-2 leading-relaxed">{act.description}</p>
                              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-body pt-2 border-t border-neutral-200/60">
                                <span>Dimension : <strong className="text-neutral-700 capitalize">{act.dimension}</strong></span>
                                <span>Effort estimé : <strong className="text-neutral-700">{act.estimated_effort}</strong></span>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-neutral-500 font-body">Aucune action recommandée pour le moment.</p>
                      )}
                    </div>
                  </Card>

                  {/* Corrections */}
                  <Card>
                    <h3 className="font-semibold font-display text-neutral-800 mb-3">Suggestions & Corrections</h3>
                    <div className="space-y-3">
                      {analysis.corrections?.map((c, idx) => (
                        <div key={idx} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-ai-100 text-ai-700">
                              Page {c.page ?? "?"}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-body mb-1">
                            <strong>Original :</strong> {c.original}
                          </p>
                          <p className="text-sm text-neutral-800 font-body mb-1">
                            <strong>Suggestion :</strong> {c.suggestion}
                          </p>
                          <p className="text-xs text-neutral-400 italic">{c.explanation}</p>
                        </div>
                      ))}
                      {(!analysis.corrections || analysis.corrections.length === 0) && (
                        <p className="text-sm text-neutral-500">Aucune correction suggérée.</p>
                      )}
                    </div>
                  </Card>

                  {/* Missing sections */}
                  <Card>
                    <h3 className="font-semibold font-display text-neutral-800 mb-3">Sections & Chapitres du Guide PFE</h3>
                    {analysis.missing_sections?.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm font-body text-neutral-700">
                        {analysis.missing_sections.map((s, i) => (
                          <li key={i} className="leading-snug">{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-success-600 font-body flex items-center gap-2">
                        <IconCheck size={16} /> Toutes les sections essentielles de la structure PFE sont présentes.
                      </p>
                    )}
                  </Card>
                </div>

                {/* Right panel: generated content */}
                <Card padded={false} className="flex flex-col">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
                    <IconSparkles size={16} className="text-ai-600" />
                    <h2 className="font-semibold font-display text-neutral-800 text-sm">Généré par l'IA (PFE Assistant)</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Résumé du rapport</h3>
                      <p className="text-sm font-body text-neutral-600 leading-relaxed">
                        {analysis.generated_content?.summary || "Non disponible"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Abstract (Anglais)</h3>
                      <p className="text-sm font-body text-neutral-500 leading-relaxed italic">
                        {analysis.generated_content?.abstract || "Non disponible"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Mots-clés</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysis.generated_content?.keywords?.map((kw, i) => (
                          <span key={i} className="px-2.5 py-1 bg-neutral-100 text-xs rounded-md text-neutral-700 border border-neutral-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2 flex items-center gap-1.5 text-amber-800">
                        📐 Remarques & Défauts de mise en forme
                      </h3>
                      {analysis.generated_content?.formatting_issues && analysis.generated_content.formatting_issues.length > 0 ? (
                        <div className="space-y-2 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                          {analysis.generated_content.formatting_issues.map((issue, i) => (
                            <div key={i} className="text-xs font-body text-amber-900 flex items-start gap-2 leading-relaxed">
                              <span className="text-amber-600 font-bold">•</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-body text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                          ✓ Aucun défaut majeur de mise en forme détecté.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Questions préparatoires pour le Jury</h3>
                      <ul className="space-y-2">
                        {analysis.generated_content?.jury_questions?.map((q, i) => (
                          <li key={i} className="text-sm font-body text-neutral-600 pl-3 border-l-2 border-ai-200 leading-relaxed">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              !isLoading && !error && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-ai-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <IconSparkles size={28} className="text-ai-600" />
                  </div>
                  <p className="text-neutral-600 font-body">
                    L'analyse IA est en cours… Les résultats apparaîtront ici automatiquement.
                  </p>
                  <p className="text-sm text-neutral-400 font-body mt-1">Statut : {analysis?.status ?? "En attente"}</p>
                </div>
              )
            )}
          </>
        )}

        {/* ─── TAB: CHAT ─── */}
        {activeTab === "chat" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 h-[70vh]">
            {/* Chat panel */}
            <Card padded={false} className="flex flex-col">
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ai-500 to-primary-600 flex items-center justify-center">
                  <IconSparkles size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold font-display text-neutral-800">Encadrini AI</p>
                  <p className="text-xs text-success-600 font-body flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
                    En ligne
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ai-500 to-primary-600 flex-shrink-0 flex items-center justify-center mt-1">
                        <IconSparkles size={12} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm font-body leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary-600 text-white rounded-tr-sm"
                          : "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ai-500 to-primary-600 flex-shrink-0 flex items-center justify-center mt-1">
                      <IconSparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-neutral-200">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendChatMessage() }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Posez votre question sur votre rapport..."
                    className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition disabled:opacity-40 flex-shrink-0"
                  >
                    <IconSend size={16} />
                  </button>
                </form>
              </div>
            </Card>

            {/* Suggested questions */}
            <div className="space-y-4">
              <Card>
                <h3 className="font-semibold font-display text-neutral-800 text-sm mb-3">Questions suggérées</h3>
                <div className="space-y-2">
                  {[
                    "Résume mon rapport en 3 lignes",
                    "Quelles sections dois-je améliorer ?",
                    "Donne-moi des conseils pour la soutenance",
                    "Comment améliorer mon introduction ?",
                    "Explique mes scores IA",
                    "Comment citer mes références ?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="w-full text-left text-xs font-body text-neutral-600 px-3 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ─── TAB: CHECKER IA ─── */}
        {activeTab === "checker" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Input side */}
            <Card className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold font-display text-neutral-800 mb-1">Analyseur de contenu IA</h3>
                <p className="text-sm text-neutral-500 font-body">
                  Collez un extrait de votre rapport pour détecter si le contenu semble généré par une IA.
                  Si le score dépasse 30%, une version réécrite sera proposée automatiquement.
                </p>
              </div>

              <textarea
                value={checkerText}
                onChange={(e) => setCheckerText(e.target.value)}
                placeholder="Collez ici votre texte à analyser (introduction, paragraphe, section...)"
                rows={10}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-none transition"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-body">{checkerText.split(/\s+/).filter(Boolean).length} mots</span>
                <Button
                  onClick={runAICheck}
                  disabled={!checkerText.trim() || isChecking}
                  variant="ai"
                  icon={<IconSparkles size={14} />}
                >
                  {isChecking ? "Analyse en cours…" : "Checker IA"}
                </Button>
              </div>

              {/* Result badge */}
              {checkerResult && (
                <div className={`rounded-xl p-4 border ${
                  checkerResult.ai_score <= 30
                    ? "bg-success-50 border-success-200"
                    : checkerResult.ai_score <= 60
                    ? "bg-warning-50 border-warning-200"
                    : "bg-danger-50 border-danger-200"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <ScoreBadge score={checkerResult.ai_score} label={checkerResult.label} />
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        checkerResult.ai_score <= 30 ? "bg-success-500"
                        : checkerResult.ai_score <= 60 ? "bg-warning-500"
                        : "bg-danger-500"
                      }`}
                      style={{ width: `${checkerResult.ai_score}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 font-body">
                    {checkerResult.ai_score <= 30
                      ? "✅ Ce texte semble principalement écrit par un humain."
                      : checkerResult.ai_score <= 60
                      ? "⚠️ Ce texte contient une proportion modérée de contenu IA. Envisagez de le réécrire."
                      : "🚨 Ce texte est fortement susceptible d'être généré par une IA. Une réécriture est recommandée."}
                  </p>
                  {checkerResult.rewritten && (
                    <button
                      onClick={() => setShowRewritten(true)}
                      className="mt-3 text-sm font-medium text-primary-600 hover:underline"
                    >
                      Voir la version réécrite →
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* Output side */}
            <Card className="flex flex-col gap-3">
              <h3 className="font-semibold font-display text-neutral-800">Version réécrite</h3>

              {!checkerResult ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                    <IconSparkles size={24} className="text-neutral-300" />
                  </div>
                  <p className="text-sm text-neutral-400 font-body">
                    La version humanisée apparaîtra ici si le score dépasse 30%.
                  </p>
                </div>
              ) : checkerResult.rewritten && showRewritten ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-1 rounded-full bg-success-100 text-success-700 font-medium">
                      ✅ Réécriture IA → Humanisée
                    </span>
                  </div>
                  <textarea
                    readOnly
                    value={checkerResult.rewritten}
                    rows={12}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-body text-neutral-700 resize-none"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(checkerResult.rewritten!)
                    }}
                  >
                    Copier le texte
                  </Button>
                </>
              ) : checkerResult.ai_score <= 30 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mb-3">
                    <IconCheck size={24} className="text-success-600" />
                  </div>
                  <p className="text-sm text-success-700 font-body font-medium">
                    Votre texte semble humain ! Aucune réécriture nécessaire.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-neutral-400 font-body">
                    Cliquez sur "Voir la version réécrite" pour afficher la version humanisée.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
