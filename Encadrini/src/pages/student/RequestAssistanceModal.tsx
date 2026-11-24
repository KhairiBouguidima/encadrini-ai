import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { IconSparkles, IconCheck, IconX, IconShield } from "../../components/ui/Icons"
import {
  api,
  type AssistanceServiceType,
  type AssistanceRequest,
  type PaymentGatewayProvider
} from "../../lib/api"

interface RequestAssistanceModalProps {
  isOpen: boolean
  onClose: () => void
  reportTitle?: string
  reportId?: string
  projectId?: string
  onSuccess?: (req: AssistanceRequest) => void
}

const SERVICES: {
  type: AssistanceServiceType
  title: string
  price: number
  description: string
  features: string[]
}[] = [
  {
    type: "MISE_EN_PAGE_WORD",
    title: "Mise en page académique Word",
    price: 35,
    description: "Conformité totale avec le guide de rédaction de votre université.",
    features: [
      "Génération du sommaire, liste des figures et tables automatique",
      "Pagination différenciée (chiffres romains pour l'intro, arabes pour le corps)",
      "Marges, interlignes et styles de titres normalisés",
      "Numérotation hiérarchique automatique",
    ],
  },
  {
    type: "TEMPLATE_LATEX",
    title: "Template LaTeX Universitaire",
    price: 45,
    description: "Idéal pour les rapports d'ingénierie, mathématiques et informatique.",
    features: [
      "Intégration dans le template officiel LaTeX de votre faculté",
      "Formatage impeccable des formules mathématiques et algorithmes",
      "Gestion et compilation propre de la bibliographie BibTeX",
      "Fichiers sources .tex + PDF haute résolution livrés",
    ],
  },
  {
    type: "PACK_COMPLET",
    title: "Pack Sérénité Complet",
    price: 65,
    description: "La formule tout-en-un pour un document prêt à être imprimé et relié.",
    features: [
      "Mise en page complète Word ou LaTeX",
      "Redimensionnement et alignement des figures et graphiques",
      "Relecture typographique (espaces insécables, guillemets, ponctuation)",
      "Vérification de la conformité de la page de garde officielle",
    ],
  },
]

export function RequestAssistanceModal({
  isOpen,
  onClose,
  reportTitle = "Rapport de PFE",
  reportId,
  projectId,
  onSuccess,
}: RequestAssistanceModalProps) {
  const [selectedService, setSelectedService] = useState<AssistanceServiceType>("MISE_EN_PAGE_WORD")
  const [notes, setNotes] = useState("")
  const [deadline, setDeadline] = useState("")
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayProvider>("KONNECT")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen) return null

  const currentService = SERVICES.find((s) => s.type === selectedService) || SERVICES[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await api.createAssistanceRequest({
        report_title: reportTitle,
        report_id: reportId,
        project_id: projectId,
        service_type: selectedService,
        notes_from_student: notes,
        deadline_date: deadline,
        payment_provider: selectedGateway,
      })
      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la création de la demande.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-neutral-200 overflow-hidden animate-in fade-in zoom-in duration-150 my-6">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-primary-950 via-primary-900 to-indigo-950 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-neutral-300 hover:text-white cursor-pointer"
          >
            <IconX size={20} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold mb-2">
            <IconSparkles size={14} className="text-amber-400" />
            Techniciens de Confiance Certifiés
          </div>
          <h2 className="text-2xl font-bold font-display">Aide à la Mise en Page de votre Rapport</h2>
          <p className="text-xs sm:text-sm text-primary-100 mt-1">
            Confiez la forme et la typographie de votre mémoire à un technicien vérifié pour respecter à 100% les exigences de votre jury.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Services Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
              1. Choisissez la formule adaptée à votre mémoire :
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              {SERVICES.map((s) => {
                const isSelected = selectedService === s.type
                return (
                  <div
                    key={s.type}
                    onClick={() => setSelectedService(s.type)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-primary-600 bg-primary-50/30 ring-2 ring-primary-500 shadow-xs"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-neutral-900">{s.title}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-primary-950 mb-2">
                        {s.price} <span className="text-xs font-semibold text-neutral-500">DT</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed mb-3">
                        {s.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 space-y-1">
                      {s.features.slice(0, 2).map((f) => (
                        <div key={f} className="text-[10px] text-neutral-600 flex items-start gap-1">
                          <IconCheck size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Student Guidelines / Remarks */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
              2. Consignes & Exigences spécifiques de votre Faculté :
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: FST / ENIT - Police Calibri 11, interligne 1.5, marges 2.5cm partout. Merci de bien vérifier la numérotation des chapitres."
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Date limite souhaitée :
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Passerelle de Paiement en Tunisie :
              </label>
              <select
                value={selectedGateway}
                onChange={(e) => setSelectedGateway(e.target.value as PaymentGatewayProvider)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="KONNECT">Konnect (Carte Bancaire / e-Dinar / Flouci)</option>
                <option value="FLOUCI">Flouci (Application mobile & QR)</option>
                <option value="PAYMEE">Paymee (Cartes CIB nationales & e-Dinar)</option>
              </select>
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-500">Tarif standard fixé par l'administration :</div>
              <div className="text-xl font-extrabold text-neutral-900">
                {currentService.price} DT <span className="text-xs font-normal text-neutral-500">(Paiement sécurisé)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Annuler
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold cursor-pointer shadow-sm px-5"
              >
                {loading ? "Traitement..." : `Commander (${currentService.price} DT)`}
              </Button>
            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
