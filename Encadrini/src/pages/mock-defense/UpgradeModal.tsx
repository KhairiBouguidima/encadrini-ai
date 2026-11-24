import { useState, useEffect } from "react"
import { Button } from "../../components/ui/Button"
import { IconCheck, IconSparkles, IconX, IconShield } from "../../components/ui/Icons"
import {
  api,
  type SubscriptionUsage,
  type PaymentGatewayProvider,
  type PaymentProviderInfo
} from "../../lib/api"

const DEFAULT_PROVIDERS: PaymentProviderInfo[] = [
  {
    id: "KONNECT",
    name: "Konnect Network",
    description: "Carte Bancaire nationale (GIE), Carte e-Dinar (Poste) & Portefeuille Flouci",
    badges: ["e-Dinar", "Carte Bancaire", "Flouci", "Visa / Mastercard"],
    is_configured: false,
  },
  {
    id: "FLOUCI",
    name: "Flouci",
    description: "Paiement direct mobile via l'application Flouci (QR Code instantané)",
    badges: ["App Flouci", "QR Code"],
    is_configured: false,
  },
  {
    id: "PAYMEE",
    name: "Paymee",
    description: "Cartes Bancaires CIB tunisiennes & e-Dinar de la Poste",
    badges: ["Cartes CIB", "e-Dinar"],
    is_configured: false,
  },
]

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
  const [notice, setNotice] = useState("")
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayProvider>("KONNECT")
  const [priceTnd, setPriceTnd] = useState(25)
  const [providers, setProviders] = useState<PaymentProviderInfo[]>(DEFAULT_PROVIDERS)

  useEffect(() => {
    api.getPaymentProviders()
      .then((res) => {
        if (res.price_tnd) setPriceTnd(res.price_tnd)
        if (res.providers && res.providers.length > 0) {
          setProviders(res.providers)
        }
      })
      .catch(() => {
        // Fallback to default providers silently
      })
  }, [])

  const handleDowngradeToFree = async () => {
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const res = await api.upgradeSubscription("FREE")
      onUpgraded(res)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Erreur lors du retour au forfait gratuit.")
    } finally {
      setLoading(false)
    }
  }

  const handleTunisianPayment = async () => {
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const res = await api.initiatePayment(selectedGateway, "PREMIUM")
      
      if (res.is_simulation) {
        setNotice("Simulation active : validation de la transaction de test...")
        // In dev / test mode without merchant keys, verify immediately
        const verifyRes = await api.verifyPayment(res.transaction_id)
        if (verifyRes.is_successful) {
          const freshUsage = await api.getSubscriptionUsage()
          onUpgraded(freshUsage)
          setNotice("Abonnement PREMIUM activé avec succès (Mode Test) !")
          setTimeout(() => {
            onClose()
          }, 1200)
          return
        }
      }

      // If live gateway URL is returned, redirect student to the checkout page
      if (res.pay_url) {
        window.location.href = res.pay_url
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'initialisation du paiement.")
    } finally {
      setLoading(false)
    }
  }

  const selectedProviderInfo = providers.find((p) => p.id === selectedGateway)

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-neutral-200 overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-indigo-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-neutral-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <IconX size={20} />
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <IconSparkles size={14} /> Passerelles de Paiement en Tunisie
          </div>
          <h2 className="text-2xl font-bold font-display">Choisissez votre formule Encadrini</h2>
          <p className="text-primary-100 text-sm mt-1">
            Simulations complètes, jury adaptatif, stress tests et révisions guidées pour réussir votre soutenance.
          </p>
        </div>

        {/* Error / Notice Banners */}
        {error && (
          <div className="p-4 mx-6 mt-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-4 mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
            <IconCheck size={16} className="text-emerald-600" />
            {notice}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Plan Comparison Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Free Plan */}
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
                <div className="text-2xl font-bold text-neutral-900 mb-1">0 DT</div>
                <p className="text-xs text-neutral-500 mb-4">Pour découvrir le simulateur</p>
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
                  onClick={handleDowngradeToFree}
                >
                  Basculer vers Gratuit
                </Button>
              ) : (
                <div className="text-center text-xs text-neutral-400 py-1 font-medium">Forfait actuel</div>
              )}
            </div>

            {/* Premium Plan */}
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
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-neutral-900">{priceTnd} DT</span>
                  <span className="text-xs text-neutral-500 font-medium">/ mois (30 jours)</span>
                </div>
                <p className="text-xs text-neutral-500 mb-4">Préparation intensive avec jury IA</p>
                <ul className="space-y-2 text-xs text-neutral-700 mb-4">
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
                    <span><strong>Mode Vocal Oral</strong> avec analyse audio & débit</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCheck size={14} className="text-primary-600 flex-shrink-0 font-bold" />
                    <span><strong>Plan de révision priorisé</strong> & réponses modèles</span>
                  </li>
                </ul>
              </div>

              {currentPlan === "PREMIUM" && (
                <div className="text-center text-xs text-emerald-700 font-semibold py-1 bg-emerald-50 rounded-lg">
                  Forfait Premium actif
                </div>
              )}
            </div>

          </div>

          {/* Tunisian Payment Methods Selection */}
          {currentPlan !== "PREMIUM" && (
            <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span>🇹🇳 Choisissez votre passerelle de paiement en Tunisie :</span>
                </label>
                <span className="text-xs text-neutral-500">Paiement sécurisé en TND</span>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                {providers.map((p) => {
                  const isSelected = selectedGateway === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedGateway(p.id)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary-600 bg-white ring-2 ring-primary-500 shadow-sm"
                          : "border-neutral-200 bg-white hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-neutral-900">{p.name}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-primary-600 bg-primary-600" : "border-neutral-300"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-500 line-clamp-2 mb-2.5">
                        {p.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {p.badges.map((b) => (
                          <span
                            key={b}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Checkout Action Button */}
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-neutral-200">
                <div className="text-xs text-neutral-600">
                  Total à régler : <strong className="text-neutral-900 text-sm">{priceTnd} DT</strong> pour 30 jours
                </div>
                <Button
                  variant="primary"
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold cursor-pointer shadow-sm px-6 py-2.5"
                  disabled={loading}
                  onClick={handleTunisianPayment}
                >
                  {loading
                    ? "Initialisation..."
                    : `Payer ${priceTnd} DT via ${selectedProviderInfo?.name || selectedGateway}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <span>Activation instantanée • Compatible Cartes Bancaires tunisiennes & e-Dinar</span>
          <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
        </div>

      </div>
    </div>
  )
}
