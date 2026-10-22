import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { IconCheck, IconSparkles, IconX, IconShield } from "../../components/ui/Icons"
import { api, type SubscriptionUsage } from "../../lib/api"

export function UpgradeModal({
  currentPlan,
  onClose,
  onUpgraded,
}: {
  currentPlan: string
  onClose: () => void
  onUpgraded: (usage: SubscriptionUsage) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleUpgrade = async (plan: "FREE" | "PREMIUM") => {
    setLoading(true)
    setError("")
    try {
      const res = await api.upgradeSubscription(plan)
      onUpgraded(res)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Erreur lors du changement de forfait.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-neutral-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-indigo-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-neutral-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <IconX size={20} />
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <IconSparkles size={14} /> Formules d'Entraînement
          </div>
          <h2 className="text-2xl font-bold font-display">Choisissez votre niveau de préparation</h2>
          <p className="text-primary-100 text-sm mt-1">
            Simulations illimitées, jury adaptatif et retours détaillés pour exceller lors de votre soutenance.
          </p>
        </div>

        {error && (
          <div className="p-4 mx-6 mt-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Plan Gratuit */}
          <div className={`p-5 rounded-xl border flex flex-col justify-between ${
            currentPlan === "FREE" ? "border-primary-300 bg-primary-50/40" : "border-neutral-200 bg-white"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-neutral-900">Formule Standard</h3>
                {currentPlan === "FREE" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                    Actif
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-neutral-900 mb-4">Gratuit</div>
              <ul className="space-y-2 text-xs text-neutral-600 mb-6">
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <span><strong>3 simulations</strong> de soutenance / mois</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Jusqu'à <strong>5 questions</strong> par session</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Modes Entraînement et Réel</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Évaluation selon 6 critères académiques</span>
                </li>
              </ul>
            </div>
            {currentPlan !== "FREE" ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={loading}
                onClick={() => handleUpgrade("FREE")}
              >
                Basculer vers Gratuit
              </Button>
            ) : (
              <div className="text-center text-xs text-neutral-400 py-1 font-medium">Forfait actuel</div>
            )}
          </div>

          {/* Plan Premium */}
          <div className={`p-5 rounded-xl border flex flex-col justify-between relative shadow-sm ${
            currentPlan === "PREMIUM" ? "border-primary-500 bg-primary-50/30 ring-2 ring-primary-500" : "border-primary-200 bg-gradient-to-b from-indigo-50/30 to-white"
          }`}>
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-primary-600 text-white text-[11px] font-bold shadow-xs">
              RECOMMANDÉ
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-primary-900 flex items-center gap-1.5">
                  <IconShield size={16} className="text-primary-600" />
                  Formule Premium
                </h3>
                {currentPlan === "PREMIUM" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Actif
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-neutral-900 mb-1">Illimité / Pro</div>
              <p className="text-xs text-neutral-500 mb-4">Pour une maîtrise totale le jour J</p>
              <ul className="space-y-2 text-xs text-neutral-700 mb-6">
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                  <span><strong>25 simulations</strong> par mois</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                  <span>Jusqu'à <strong>15 questions</strong> approfondies</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                  <span><strong>Mode Stress Test</strong> (questions pièges & relances)</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                  <span><strong>Mode Vocal Oral</strong> avec analyse du débit & tics</span>
                </li>
                <li className="flex items-center gap-2">
                  <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                  <span><strong>Plan de révision priorisé</strong> & réponses modèles</span>
                </li>
              </ul>
            </div>
            {currentPlan !== "PREMIUM" ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold cursor-pointer shadow-xs"
                disabled={loading}
                onClick={() => handleUpgrade("PREMIUM")}
              >
                {loading ? "Mise à niveau..." : "Activer Premium (Accès Immédiat)"}
              </Button>
            ) : (
              <div className="text-center text-xs text-emerald-700 font-semibold py-1">Forfait Premium actif</div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <span>Activation instantanée sans engagement de durée.</span>
          <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  )
}
