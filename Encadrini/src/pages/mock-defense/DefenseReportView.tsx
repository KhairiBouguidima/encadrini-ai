import { useEffect, useState } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { 
  IconSparkles, IconAward, IconAlertTriangle, IconLightbulb, 
  IconShield, IconRefresh, IconChevronRight, IconCheck, 
  IconClock, IconPlay, IconFileText, IconUser
} from "../../components/ui/Icons"
import { 
  api, type MockDefenseReport, type SimulationDetail, type User 
} from "../../lib/api"

export function DefenseReportView({
  simulationId,
  onBack,
  user: _user,
}: {
  simulationId: string
  onBack: () => void
  user?: User | null
}) {
  const [report, setReport] = useState<MockDefenseReport | null>(null)
  const [simulation, setSimulation] = useState<SimulationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Toggled sections state
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({})
  const [expandedModels, setExpandedModels] = useState<Record<number, boolean>>({})

  const toggleAnswer = (key: string) => {
    setExpandedAnswers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleModel = (idx: number) => {
    setExpandedModels((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const loadData = async () => {
    setLoading(true)
    setError("")
    try {
      const [repData, simData] = await Promise.all([
        api.getMockDefenseReport(simulationId),
        api.getMockDefense(simulationId),
      ])
      setReport(repData)
      setSimulation(simData)
    } catch (err: any) {
      setError(err?.message || "Impossible de charger le rapport de soutenance.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (simulationId) {
      loadData()
    }
  }, [simulationId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-neutral-600 font-medium">Génération et chargement du rapport de soutenance...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-8 text-center bg-white border border-rose-200">
          <IconAlertTriangle size={36} className="text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-neutral-800 mb-2">Erreur lors du chargement</h3>
          <p className="text-sm text-neutral-600 mb-6">{error || "Aucun rapport disponible."}</p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={onBack}>Retour</Button>
            <Button variant="primary" onClick={loadData}>Réessayer</Button>
          </div>
        </Card>
      </div>
    )
  }

  const score = Math.round(report.overall_score || 0)
  const scoreColor = 
    score >= 80 ? "text-emerald-600 border-emerald-500 bg-emerald-50" :
    score >= 60 ? "text-blue-600 border-blue-500 bg-blue-50" :
    score >= 40 ? "text-amber-600 border-amber-500 bg-amber-50" :
    "text-rose-600 border-rose-500 bg-rose-50"

  const scoreProgressColor = 
    score >= 80 ? "bg-emerald-500" :
    score >= 60 ? "bg-blue-500" :
    score >= 40 ? "bg-amber-500" :
    "bg-rose-500"

  const formatCriterionName = (key: string) => {
    const map: Record<string, string> = {
      technicalAccuracy: "Précision technique",
      depthOfUnderstanding: "Profondeur de compréhension",
      reasoning: "Qualité du raisonnement",
      clarity: "Clarté et structure",
      justification: "Justification des choix",
      completeness: "Complétude et pertinence",
    }
    return map[key] || key
  }

  const formatJuryRole = (role: string) => {
    const map: Record<string, { label: string; desc: string }> = {
      PRESIDENT: { label: "Président du Jury", desc: "Vision globale, problématique, méthodologie" },
      TECHNICAL: { label: "Examinateur Technique", desc: "Architecture, code, bases de données, sécurité" },
      CRITICAL: { label: "Examinateur Critique", desc: "Limites, cas limites, justification des compromis" },
    }
    return map[role] || { label: role, desc: "Évaluation du jury" }
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "Non mesurée"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} min ${secs} sec`
  }

  const priorityStyles = {
    critical: "bg-rose-50 border-rose-200 text-rose-700",
    important: "bg-amber-50 border-amber-200 text-amber-700",
    minor: "bg-blue-50 border-blue-200 text-blue-700",
  }

  const priorityLabels = {
    critical: "Priorité critique",
    important: "Priorité importante",
    minor: "Recommandé",
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <button 
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 mb-2 transition-colors cursor-pointer"
          >
            ← Retour aux simulations
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-heading">
            Rapport de Performance — Soutenance
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Projet : <span className="font-semibold text-neutral-800">{simulation?.title || "Soutenance simulée"}</span>
            {report.completed_at && ` • Complété le ${new Date(report.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`}
            {report.total_duration_seconds ? ` • Durée : ${formatDuration(report.total_duration_seconds)}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.print()} className="text-xs">
            Imprimer / PDF
          </Button>
          <Button variant="primary" onClick={onBack} className="text-xs">
            Terminer la session
          </Button>
        </div>
      </div>

      {/* 2. Overall Score & Readiness Hero Banner */}
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-white to-neutral-50 border border-neutral-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center ${scoreColor} shadow-inner`}>
              <span className="text-4xl font-extrabold font-heading">{score}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mt-0.5">/ 100</span>
            </div>
            <div className="mt-3 text-center">
              <span className="text-xs font-medium text-neutral-400">Score global de préparation</span>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Niveau estimé</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-800">
                  {report.readiness_level}
                </span>
              </div>
              <h2 className="text-xl font-bold text-neutral-900">
                {score >= 80 ? "Excellente prestation ! Vous êtes prêt pour la soutenance." :
                 score >= 60 ? "Bonne prestation générale avec des points techniques à consolider." :
                 score >= 40 ? "Prestation convenable mais plusieurs arguments manquent de rigueur." :
                 "Niveau insuffisant. Une révision approfondie des choix techniques est nécessaire."}
              </h2>
              <p className="text-sm text-neutral-600 mt-2">
                Ce bilan analyse vos réponses face aux 3 membres du jury virtuel en fonction des exigences de votre rapport PFE et des standards académiques.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200 text-xs text-neutral-600">
              <span className="bg-neutral-100 px-2.5 py-1 rounded-md font-medium">
                Niveau : {simulation?.academic_level || "PFE"}
              </span>
              <span className="bg-neutral-100 px-2.5 py-1 rounded-md font-medium">
                Difficulté : {simulation?.difficulty || "intermédiaire"}
              </span>
              <span className="bg-neutral-100 px-2.5 py-1 rounded-md font-medium">
                Mode : {simulation?.mode || "Réaliste"}
              </span>
              {simulation?.tech_stack && simulation.tech_stack.length > 0 && (
                <span className="bg-neutral-100 px-2.5 py-1 rounded-md font-medium">
                  Technologies : {simulation.tech_stack.slice(0, 4).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Criteria Averages (6 dimensions) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconAward size={20} className="text-primary-600" />
            Évaluation par critères académiques
          </h3>
          <span className="text-xs text-neutral-500">Moyenne sur 100</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(report.criteria_averages || {}).map(([key, val]) => {
            const valNum = Math.round(Number(val) || 0)
            const cColor = 
              valNum >= 75 ? "bg-emerald-500" :
              valNum >= 55 ? "bg-blue-500" :
              valNum >= 40 ? "bg-amber-500" : "bg-rose-500"
            return (
              <Card key={key} className="p-4 bg-white border border-neutral-200">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold text-neutral-800">{formatCriterionName(key)}</span>
                  <span className="text-sm font-bold text-neutral-900">{valNum}%</span>
                </div>
                <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${cColor}`} 
                    style={{ width: `${Math.min(100, Math.max(0, valNum))}%` }} 
                  />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 4. Jury & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jury Performance */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconUser size={18} className="text-primary-600" />
            Performance face aux membres du jury
          </h3>
          <div className="space-y-3">
            {Object.entries(report.jury_performance || {}).map(([role, jScore]) => {
              const info = formatJuryRole(role)
              const scoreVal = Math.round(Number(jScore) || 0)
              return (
                <Card key={role} className="p-4 bg-white border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900">{info.label}</h4>
                      <p className="text-xs text-neutral-500">{info.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-neutral-900">{scoreVal}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden mt-3">
                    <div 
                      className="bg-primary-600 h-full rounded-full" 
                      style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }} 
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Category Performance */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconShield size={18} className="text-primary-600" />
            Performance par domaine technique
          </h3>
          <div className="space-y-3">
            {Object.entries(report.category_performance || {}).map(([cat, cScore]) => {
              const scoreVal = Math.round(Number(cScore) || 0)
              return (
                <Card key={cat} className="p-4 bg-white border border-neutral-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-neutral-800">{cat}</span>
                    <span className="text-sm font-bold text-neutral-900">{scoreVal}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${scoreVal >= 60 ? "bg-emerald-500" : scoreVal >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }} 
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* 5. Strongest Answers */}
      {report.strongest_answers && report.strongest_answers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconCheck size={20} className="text-emerald-600" />
            Vos meilleures réponses
          </h3>
          <div className="space-y-3">
            {report.strongest_answers.map((item, idx) => {
              const key = `strong-${idx}`
              const isExpanded = !!expandedAnswers[key]
              return (
                <Card key={key} className="p-5 bg-emerald-50/40 border border-emerald-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Question #{item.question_number}
                        </span>
                        <span className="text-xs font-bold text-emerald-700">{item.score}/100</span>
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900">{item.text}</h4>
                    </div>
                  </div>

                  {item.strengths && item.strengths.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-100 space-y-1">
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Points forts retenus :</span>
                      <ul className="text-xs text-neutral-700 space-y-1 mt-1 pl-4 list-disc">
                        {item.strengths.map((str, sIdx) => (
                          <li key={sIdx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.student_answer && (
                    <div className="mt-3 pt-2">
                      <button 
                        onClick={() => toggleAnswer(key)}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? "Masquer votre réponse" : "Voir votre réponse"}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-emerald-100 text-xs text-neutral-700 italic">
                          "{item.student_answer}"
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 6. Weakest Answers */}
      {report.weakest_answers && report.weakest_answers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconAlertTriangle size={20} className="text-amber-600" />
            Réponses nécessitant une amélioration
          </h3>
          <div className="space-y-3">
            {report.weakest_answers.map((item, idx) => {
              const key = `weak-${idx}`
              const isExpanded = !!expandedAnswers[key]
              return (
                <Card key={key} className="p-5 bg-amber-50/40 border border-amber-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                          Question #{item.question_number}
                        </span>
                        <span className="text-xs font-bold text-amber-700">{item.score}/100</span>
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900">{item.text}</h4>
                    </div>
                  </div>

                  {item.weaknesses && item.weaknesses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-100 space-y-1">
                      <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Faiblesses constatées :</span>
                      <ul className="text-xs text-neutral-700 space-y-1 mt-1 pl-4 list-disc">
                        {item.weaknesses.map((w, wIdx) => (
                          <li key={wIdx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.missingPoints && item.missingPoints.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Éléments manquants clés :</span>
                      <ul className="text-xs text-neutral-700 space-y-1 mt-1 pl-4 list-disc">
                        {item.missingPoints.map((m, mIdx) => (
                          <li key={mIdx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.student_answer && (
                    <div className="mt-3 pt-2">
                      <button 
                        onClick={() => toggleAnswer(key)}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? "Masquer votre réponse" : "Voir votre réponse"}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-amber-100 text-xs text-neutral-700 italic">
                          "{item.student_answer}"
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 7. Knowledge Gaps & Concepts to Revise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 bg-white border border-neutral-200">
          <div className="flex items-center gap-2 mb-3">
            <IconAlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-base font-bold text-neutral-900">Lacunes identifiées</h3>
          </div>
          {report.knowledge_gaps && report.knowledge_gaps.length > 0 ? (
            <ul className="space-y-2 text-xs text-neutral-700">
              {report.knowledge_gaps.map((gap, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500 italic">Aucune lacune majeure détectée dans cette session.</p>
          )}
        </Card>

        <Card className="p-5 bg-white border border-neutral-200">
          <div className="flex items-center gap-2 mb-3">
            <IconLightbulb size={18} className="text-blue-500" />
            <h3 className="text-base font-bold text-neutral-900">Concepts techniques à réviser</h3>
          </div>
          {report.technical_concepts_to_revise && report.technical_concepts_to_revise.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.technical_concepts_to_revise.map((concept, idx) => (
                <span 
                  key={idx}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {concept}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">Aucun concept spécifique à réviser en priorité.</p>
          )}
        </Card>
      </div>

      {/* 8. Repeated Mistakes (if any) */}
      {report.repeated_mistakes && report.repeated_mistakes.length > 0 && (
        <Card className="p-5 bg-rose-50/60 border border-rose-200">
          <div className="flex items-center gap-2 mb-2">
            <IconAlertTriangle size={18} className="text-rose-600" />
            <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider">Erreurs récurrentes à corriger impérativement</h3>
          </div>
          <ul className="space-y-1.5 text-xs text-neutral-700 pl-4 list-disc mt-2">
            {report.repeated_mistakes.map((err, idx) => (
              <li key={idx} className="text-rose-950 font-medium">{err}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* 9. Recommended Model Answers */}
      {report.recommended_model_answers && report.recommended_model_answers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconSparkles size={20} className="text-primary-600" />
            Exemples de réponses modèles attendues
          </h3>
          <div className="space-y-3">
            {report.recommended_model_answers.map((m, idx) => {
              const isOpen = !!expandedModels[idx]
              return (
                <Card key={idx} className="p-4 bg-white border border-neutral-200">
                  <div 
                    onClick={() => toggleModel(idx)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="pr-4">
                      <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">{m.examiner}</span>
                      <h4 className="text-sm font-bold text-neutral-900 mt-0.5">{m.question}</h4>
                    </div>
                    <span className="text-neutral-400 text-xs font-bold">{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-neutral-100 text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-3 rounded-lg">
                      <p className="font-medium text-neutral-900 mb-1">Structure recommandée :</p>
                      <p className="whitespace-pre-line">{m.model_answer}</p>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 10. Personalized Revision Plan */}
      {report.personalized_revision_plan && report.personalized_revision_plan.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-800 font-heading flex items-center gap-2">
            <IconClock size={20} className="text-primary-600" />
            Plan de révision personnalisé
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.personalized_revision_plan.map((item) => (
              <Card key={item.id} className={`p-4 border ${priorityStyles[item.priority] || "bg-white border-neutral-200"}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/80 border border-current">
                    {priorityLabels[item.priority] || item.priority}
                  </span>
                  <div className="text-right text-xs font-medium">
                    <span>{item.estimated_time}</span>
                    <span className="mx-1">•</span>
                    <span className="font-bold text-emerald-700">{item.estimated_gain}</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 11. Suggested Questions for Next Session */}
      {report.suggested_next_questions && report.suggested_next_questions.length > 0 && (
        <Card className="p-5 bg-white border border-neutral-200">
          <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
            <IconPlay size={18} className="text-primary-600" />
            Questions recommandées pour votre prochaine simulation
          </h3>
          <ol className="space-y-2 text-xs text-neutral-700 list-decimal pl-5">
            {report.suggested_next_questions.map((q, idx) => (
              <li key={idx} className="font-medium">{q}</li>
            ))}
          </ol>
        </Card>
      )}

      {/* 12. Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
        <IconAlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold uppercase tracking-wider text-[11px] mb-0.5">Avertissement académique légal</p>
          <p className="leading-relaxed">
            {report.disclaimer || "Ce score est une estimation pédagogique basée sur une analyse d'intelligence artificielle et ne constitue en aucun cas une note officielle ni une garantie d'admission lors de votre véritable soutenance universitaire."}
          </p>
        </div>
      </div>
    </div>
  )
}
