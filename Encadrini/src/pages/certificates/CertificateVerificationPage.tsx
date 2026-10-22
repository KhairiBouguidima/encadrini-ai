import { useEffect, useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Card } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import {
  IconShield,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconSearch,
  IconUser,
  IconCalendar,
  IconAward,
  IconLock,
} from "../../components/ui/Icons"
import {
  api,
  type PublicCertificateVerification,
} from "../../lib/api"

interface CertificateVerificationPageProps {
  initialCertId?: string
  onGoHome?: () => void
}

function formatDate(iso?: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CertificateVerificationPage({
  initialCertId = "",
  onGoHome,
}: CertificateVerificationPageProps) {
  const [query, setQuery] = useState(initialCertId)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PublicCertificateVerification | null>(null)
  const [searched, setSearched] = useState(false)

  const verify = async (idToVerify: string) => {
    const clean = idToVerify.trim()
    if (!clean) return
    setLoading(true)
    setSearched(true)
    try {
      const data = await api.verifyCertificate(clean)
      setResult(data)
    } catch (err: any) {
      setResult({
        is_valid: false,
        status_label: "ERREUR DE CONNEXION AU SERVICE DE VÉRIFICATION",
        certificate_id: clean,
        project_title: "Non disponible",
        institution_name: "Inconnu",
        academic_year: "-",
        student_names: [],
        supervisor_name: "-",
        supervisor_role: "-",
        version_number: 0,
        legal_notice: err.message || "Erreur lors de la vérification.",
        certificate_hash: "ERROR",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialCertId) {
      setQuery(initialCertId)
      verify(initialCertId)
    }
  }, [initialCertId])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verify(query)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="cursor-pointer" onClick={onGoHome}>
          <Logo />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-500 hidden sm:inline">
            Portail de Vérification Officielle
          </span>
          {onGoHome && (
            <Button variant="outline" size="sm" onClick={onGoHome}>
              Accueil
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto border border-primary-200 shadow-xs">
            <IconShield size={26} />
          </div>
          <h1 className="text-2xl font-bold font-heading text-neutral-900">
            Vérification d'Authenticité du Certificat PFE
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 font-body max-w-lg mx-auto">
            Scannez le QR Code ou saisissez l'identifiant du certificat pour attester de la validation
            officielle par l'encadreur auprès de l'administration universitaire.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: CERT-PFE-2026-BB651A30 ou jeton de vérification..."
              className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden font-body shadow-xs"
            />
            <div className="absolute left-3.5 top-3 text-neutral-400">
              <IconSearch size={18} />
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading || !query.trim()}
          >
            {loading ? "Vérification..." : "Vérifier"}
          </Button>
        </form>

        {/* Verification Result */}
        {loading && (
          <div className="p-12 text-center text-neutral-400">
            <IconClock size={28} className="animate-spin mx-auto mb-2 text-primary-500" />
            Vérification de l'intégrité auprès du registre central Encadrini...
          </div>
        )}

        {!loading && searched && result && (
          <div className="space-y-4">
            {result.is_valid ? (
              <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary-600" />

                {/* Authenticity Seal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <IconCheck size={28} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Certificat Authentique & Conforme
                      </span>
                      <h2 className="text-lg font-bold text-neutral-900 font-heading">
                        Validation Officielle Confirmée
                      </h2>
                    </div>
                  </div>

                  <div className="text-right self-start sm:self-center">
                    <span className="text-xs font-mono font-bold text-primary-700 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full">
                      {result.certificate_id}
                    </span>
                  </div>
                </div>

                {/* Details Table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-xs">
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/70 space-y-2.5">
                    <span className="font-bold text-neutral-800 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                      Projet & Candidats
                    </span>
                    <div>
                      <span className="text-neutral-500 block">Projet PFE :</span>
                      <strong className="text-neutral-900 font-semibold text-sm">{result.project_title}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Établissement :</span>
                      <strong className="text-neutral-800">{result.institution_name}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Candidat(s) / Binôme :</span>
                      <div className="mt-0.5 space-y-0.5">
                        {result.student_names.map((name, i) => (
                          <div key={i} className="text-neutral-800 font-semibold">
                            • {name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Version du manuscrit :</span>
                      <strong className="text-neutral-800">Version {result.version_number} (Dépôt Validé)</strong>
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/70 space-y-2.5">
                    <span className="font-bold text-neutral-800 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                      Encadrement & Date
                    </span>
                    <div>
                      <span className="text-neutral-500 block">Encadrant Académique :</span>
                      <strong className="text-neutral-900 font-semibold">{result.supervisor_name}</strong>
                    </div>
                    {result.enterprise_supervisor_name && (
                      <div>
                        <span className="text-neutral-500 block">Encadrant Entreprise :</span>
                        <strong className="text-neutral-800">{result.enterprise_supervisor_name}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-500 block">Date d'approbation :</span>
                      <strong className="text-neutral-800">{formatDate(result.validation_date)}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Score Conformité IA :</span>
                      {result.ai_compliance_score !== null && result.ai_compliance_score !== undefined ? (
                        <span className="font-bold text-emerald-700">
                          {result.ai_compliance_score}% ({result.ai_compliance_level || "CONFORME"})
                        </span>
                      ) : (
                        <span className="text-neutral-500 italic">Non requis / Optionnel</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Security Footer Notice */}
                <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                    <IconLock size={14} className="text-slate-600" />
                    Intégrité Cryptographique & Confidentialité
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {result.legal_notice}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 truncate pt-1">
                    Empreinte SHA-256 : {result.certificate_hash}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-rose-300 rounded-2xl p-6 sm:p-8 shadow-md text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <IconAlertTriangle size={26} />
                </div>
                <h2 className="text-lg font-bold text-rose-900 font-heading">
                  Certificat Non Valide ou Introuvable
                </h2>
                <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed font-body">
                  Aucun certificat officiel valide ne correspond à l'identifiant « <strong>{result.certificate_id}</strong> ».
                  Vérifiez la saisie ou assurez-vous que l'encadreur a bien accordé la validation finale.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
