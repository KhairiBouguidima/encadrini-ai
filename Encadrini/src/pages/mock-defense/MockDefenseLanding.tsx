import { useEffect, useState } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { 
  IconSparkles, IconPlus, IconClock, IconAward, 
  IconChevronRight, IconTrash, IconPlay, IconShield, 
  IconFileText, IconCheck, IconRefresh 
} from "../../components/ui/Icons"
import { 
  api, type SimulationListItem, type SubscriptionUsage, type SimulationDetail, type User 
} from "../../lib/api"
import { CreateDefenseModal } from "./CreateDefenseModal"
import { UpgradeModal } from "./UpgradeModal"

export function MockDefenseLanding({
  onOpenSimulation,
  onOpenReport,
  user: _user,
}: {
  onOpenSimulation: (simulationId: string) => void
  onOpenReport: (simulationId: string) => void
  user?: User | null
}) {
  const [simulations, setSimulations] = useState<SimulationListItem[]>([])
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const [simsRes, usageRes] = await Promise.all([
        api.listMockDefenses(),
        api.getSubscriptionUsage(),
      ])
      setSimulations(simsRes)
      setUsage(usageRes)
    } catch (err: any) {
      setError(err?.message || "Impossible de charger les données du simulateur.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Voulez-vous vraiment supprimer cette soutenance ?")) return
    try {
      await api.deleteMockDefense(id)
      setSimulations(simulations.filter((s) => s.id !== id))
    } catch (err: any) {
      alert(err?.message || "Erreur lors de la suppression.")
    }
  }

  const handleCreated = (sim: SimulationDetail) => {
    setShowCreateModal(false)
    onOpenSimulation(sim.id)
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-primary-950 via-primary-900 to-indigo-950 p-8 sm:p-10 text-white overflow-hidden shadow-xl border border-primary-800/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold uppercase tracking-wider mb-4 border border-white/15">
            <IconSparkles size={14} className="text-amber-400" /> Simulateur de Soutenance IA Académique
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display tracking-tight leading-tight">
            Maîtrisez votre soutenance orale face à un jury d'experts IA
          </h1>
          <p className="mt-4 text-base sm:text-lg text-primary-100/90 leading-relaxed font-body">
            Téléversez votre rapport de PFE ou mémoire. L'IA analyse votre architecture, vos choix techniques et vos résultats pour simuler un vrai jury académique et vous préparer au jour J.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              variant="primary"
              className="bg-primary-500 hover:bg-primary-600 text-white font-bold shadow-lg shadow-primary-900/40 cursor-pointer text-base"
              onClick={() => setShowCreateModal(true)}
            >
              <IconPlus size={20} />
              Lancer une Nouvelle Soutenance Blanche
            </Button>

            {usage && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs text-white font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <IconShield size={16} className="text-primary-300" />
                <span>
                  Forfait <strong>{usage.plan}</strong> : {usage.monthly_simulations_remaining} restante(s)
                </span>
                <span className="underline ml-1 text-primary-200">Gérer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Virtual Jury Presentation */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 font-display">Votre Jury Virtuel Personnalisé</h2>
            <p className="text-xs text-neutral-500">Trois examinateurs aux rôles académiques complémentaires</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* President */}
          <Card className="!p-5 border-neutral-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-lg">
                PL
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Pr. Robert Laurent</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                  Président du Jury
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Évalue la problématique générale, la valeur ajoutée du projet, la méthodologie adoptée et l'esprit de synthèse.
            </p>
          </Card>

          {/* Technical Examiner */}
          <Card className="!p-5 border-neutral-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-lg">
                AM
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Dr. Amina Mansouri</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Examinatrice Technique
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Sonde en profondeur l'architecture, le choix de la base de données, la sécurité des flux et la qualité du code.
            </p>
          </Card>

          {/* Critical Examiner */}
          <Card className="!p-5 border-neutral-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-lg">
                PD
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Dr. Philippe Durand</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Examinateur Critique
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Détecte les contradictions, challenge les affirmations non prouvées, teste la montée en charge et les cas de panne.
            </p>
          </Card>
        </div>
      </div>

      {/* Previous Sessions & History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-neutral-900 font-display">Historique de vos Soutenances</h2>
            <button
              onClick={fetchData}
              title="Rafraîchir"
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <IconRefresh size={16} />
            </button>
          </div>
          <span className="text-xs text-neutral-500 font-medium">
            {simulations.length} session(s) enregistrée(s)
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200">
            <div className="w-8 h-8 border-3 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-500">Chargement de vos soutenances...</p>
          </div>
        ) : error ? (
          <div className="p-5 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-2xl">
            {error}
          </div>
        ) : simulations.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-neutral-300 space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
              <IconAward size={28} />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-neutral-800 text-base">Aucune soutenance simulée pour le moment</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Créez votre première simulation en téléversant votre rapport de PFE pour commencer à vous entraîner aux questions du jury.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white cursor-pointer"
            >
              <IconPlus size={16} />
              Démarrer mon premier entraînement
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {simulations.map((sim) => {
              const isFinished = sim.status === "COMPLETED"
              const progressPct = Math.round((sim.answered_questions / Math.max(1, sim.total_questions)) * 100)

              return (
                <div
                  key={sim.id}
                  onClick={() => {
                    if (isFinished) onOpenReport(sim.id)
                    else onOpenSimulation(sim.id)
                  }}
                  className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isFinished
                          ? "bg-emerald-100 text-emerald-800"
                          : sim.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {isFinished ? "Terminée" : sim.status === "IN_PROGRESS" ? "En cours" : "Prête"}
                      </span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs text-neutral-500 font-medium">
                        {sim.academic_level} — {sim.category}
                      </span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500">
                        {sim.mode === "TRAINING" ? "Entraînement" : sim.mode === "REALISTIC" ? "Mode Réel" : "Stress Test"}
                      </span>
                    </div>

                    <h3 className="font-bold text-neutral-900 text-base truncate">{sim.title}</h3>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {sim.tech_stack.slice(0, 5).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[11px]">
                          {t}
                        </span>
                      ))}
                      {sim.tech_stack.length > 5 && (
                        <span className="text-[11px] text-neutral-400">+{sim.tech_stack.length - 5}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Progress / Score */}
                    {isFinished && sim.overall_score !== null && sim.overall_score !== undefined ? (
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-neutral-500 font-medium">Note d'Aptitude</span>
                          <span className="text-xl font-bold font-display text-primary-700">
                            {sim.overall_score}/100
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 font-semibold">{sim.readiness_level}</p>
                      </div>
                    ) : (
                      <div className="w-36 text-right">
                        <div className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span>Progression</span>
                          <span className="font-semibold">{sim.answered_questions}/{sim.total_questions}</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-primary-600 h-full rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isFinished ? "secondary" : "primary"}
                        size="sm"
                        className={isFinished ? "" : "bg-primary-600 text-white"}
                      >
                        {isFinished ? (
                          <>
                            <IconAward size={15} />
                            Rapport
                          </>
                        ) : (
                          <>
                            <IconPlay size={15} />
                            Continuer
                          </>
                        )}
                      </Button>
                      <button
                        onClick={(e) => handleDelete(sim.id, e)}
                        title="Supprimer"
                        className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateDefenseModal
          usage={usage}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
          onOpenUpgrade={() => {
            setShowCreateModal(false)
            setShowUpgradeModal(true)
          }}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          currentPlan={usage?.plan || "FREE"}
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={(newUsage) => setUsage(newUsage)}
        />
      )}
    </div>
  )
}
