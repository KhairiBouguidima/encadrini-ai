import { useEffect, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconBell } from "../../components/ui/Icons"
import { api, type AIAnalysisResponse } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

export function AIWorkshop({
  onExit,
  reportId,
  versionNumber,
}: {
  onExit: () => void
  reportId: string
  versionNumber: number
}) {
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true
    const fetchAnalysis = async () => {
      if (!reportId || !versionNumber) {
        setIsLoading(false)
        setError("Aucun rapport spécifié.")
        return
      }
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
    return () => {
      isMounted = false
    }
  }, [reportId, versionNumber])


  return (
    <AppShell
      navItems={navItems}
      activeKey="workshop"
      onNavigate={() => {}}
      onExit={onExit}
      userName="Karim Boumediene"
      userRole="Étudiant · M2 informatique"
    >
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold font-display text-neutral-900 mb-1">Atelier IA</h1>
        <p className="text-sm text-neutral-500 font-body mb-6">
          Version {versionNumber}
        </p>

        {isLoading && <p className="text-sm text-neutral-500">Chargement de l'analyse...</p>}
        {error && <p className="text-sm text-danger-600">{error}</p>}

        {analysis && analysis.status === "COMPLETED" ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
            <Card padded={false}>
              <div className="px-4 py-3 border-b border-neutral-200">
                <h2 className="font-semibold font-display text-neutral-800 text-sm">Sections manquantes signalées</h2>
              </div>
              <div className="p-6 bg-neutral-50 text-sm font-body text-neutral-600 leading-relaxed space-y-3">
                {analysis.missing_sections?.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {analysis.missing_sections.map((sec, i) => <li key={i}>{sec}</li>)}
                  </ul>
                ) : (
                  <p>Aucune section vitale ne semble manquer.</p>
                )}
              </div>

              <div className="p-4 border-t border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-semibold">Qualité Globale: </span>
                    {analysis.scores?.overall_quality ?? "?"}/10
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Linguistique: </span>
                    {analysis.scores?.linguistic ?? "?"}/10
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Structure: </span>
                    {analysis.scores?.structural ?? "?"}/10
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold font-display text-neutral-800 mb-3">
                  Suggestions & Corrections
                </h3>
                <div className="space-y-3">
                  {analysis.corrections?.map((c, idx) => (
                    <div key={idx} className="border border-neutral-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium font-body rounded-full px-2 py-0.5 bg-ai-100 text-[#4c1d95]">
                          Page {c.page ?? "?"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 font-body mb-1">
                        <strong>Original:</strong> {c.original}
                      </p>
                      <p className="text-sm text-neutral-800 font-body mb-2">
                        <strong>Suggestion:</strong> {c.suggestion}
                      </p>
                      <p className="text-xs text-neutral-400 italic">
                        {c.explanation}
                      </p>
                    </div>
                  ))}
                  {(!analysis.corrections || analysis.corrections.length === 0) && (
                    <p className="text-sm text-neutral-500">Aucune correction suggérée.</p>
                  )}
                </div>
              </div>
            </Card>

            <Card padded={false} className="flex flex-col">
              <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
                <IconSparkles size={16} className="text-ai-600" />
                <h2 className="font-semibold font-display text-neutral-800 text-sm">Généré par l'IA</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Résumé</h3>
                  <p className="text-sm font-body text-neutral-600">
                    {analysis.generated_content?.summary || "Non disponible"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Mots-clés</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.generated_content?.keywords?.map((kw, i) => (
                       <span key={i} className="px-2 py-1 bg-neutral-100 text-xs rounded-md text-neutral-700">
                         {kw}
                       </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold font-display text-neutral-800 mb-2">Questions probables du Jury</h3>
                  <ul className="list-disc pl-5 text-sm font-body text-neutral-600 space-y-1">
                    {analysis.generated_content?.jury_questions?.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          !isLoading && !error && (
            <div className="text-center py-10">
              <p className="text-neutral-500">L'analyse IA n'est pas encore prête ou a échoué (Status: {analysis?.status ?? "Inconnu"}).</p>
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}
