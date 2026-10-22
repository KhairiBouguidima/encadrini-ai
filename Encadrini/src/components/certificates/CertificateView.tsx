import { useEffect, useState, useMemo } from "react"
import { Card, Avatar } from "../ui/Primitives"
import { Button } from "../ui/Button"
import {
  IconAward,
  IconCheck,
  IconDownload,
  IconShield,
  IconClock,
  IconUser,
  IconCalendar,
  IconClose,
  IconFileText,
  IconLock,
  IconSparkles,
} from "../ui/Icons"
import {
  api,
  type CertificateResponse,
  type Project,
  type User,
  type ReportHistory,
} from "../../lib/api"
import { useToast } from "../ui/Toast"

interface CertificateViewProps {
  project: Project
  currentUser: User | null
  reports?: ReportHistory[]
  onOpenVerification?: (certificateId: string) => void
}

function formatDate(iso: string) {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CertificateView({
  project,
  currentUser,
  reports = [],
  onOpenVerification,
}: CertificateViewProps) {
  const { toast } = useToast()

  const [certificate, setCertificate] = useState<CertificateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)

  // Supervisor Validation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number>(1)
  const [mention, setMention] = useState("Très Favorable — Prêt pour Soutenance")
  const [notes, setNotes] = useState("Rapport final vérifié et conforme aux exigences pédagogiques. Dépôt autorisé.")
  const [institutionName, setInstitutionName] = useState(project.academic_year || "Université de Carthage / INSAT")
  const [isValidating, setIsValidating] = useState(false)

  const isSupervisorOrAdmin = useMemo(() => {
    if (!currentUser) return false
    return currentUser.role === "ADMIN" || currentUser.role === "ENCADRER"
  }, [currentUser])

  const latestVersion = useMemo(() => {
    if (reports.length > 0 && reports[0].versions?.length > 0) {
      return reports[0].versions[reports[0].versions.length - 1].version_number
    }
    return 1
  }, [reports])

  const loadCertificate = async () => {
    setLoading(true)
    try {
      const cert = await api.getProjectCertificate(project.id)
      setCertificate(cert)
    } catch (err: any) {
      // If none exists, cert is null
      setCertificate(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (project?.id) {
      loadCertificate()
    }
  }, [project?.id])

  useEffect(() => {
    setSelectedVersion(latestVersion)
  }, [latestVersion])

  const handleDownloadPdf = async () => {
    if (!certificate) return
    setIsDownloading(true)
    try {
      await api.downloadCertificatePdf(certificate.certificate_id)
      toast({
        variant: "success",
        title: "Certificat téléchargé",
        message: "Le fichier PDF officiel a été téléchargé avec succès.",
      })
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur de téléchargement",
        message: err.message || "Impossible de générer le certificat.",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleConfirmValidation = async () => {
    setIsValidating(true)
    try {
      const cert = await api.validateFinalPFE(project.id, {
        version_number: selectedVersion,
        mention,
        notes,
        institution_name: institutionName.trim() || undefined,
      })
      setCertificate(cert)
      setIsModalOpen(false)
      toast({
        variant: "success",
        title: "Validation Finale accordée !",
        message: `Le certificat ${cert.certificate_id} a été généré avec succès.`,
      })
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Erreur de validation",
        message: err.message || "Impossible de valider définitivement le PFE.",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const copyCertId = () => {
    if (!certificate) return
    navigator.clipboard.writeText(certificate.certificate_id)
    toast({
      variant: "success",
      title: "Identifiant copié",
      message: `${certificate.certificate_id} copié dans le presse-papiers.`,
    })
  }

  if (loading) {
    return (
      <Card className="p-10 text-center text-neutral-400">
        <IconClock size={28} className="animate-spin mx-auto mb-2 text-primary-500" />
        Vérification du statut du certificat de dépôt...
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* If Not Validated Yet */}
      {!certificate && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 mx-auto flex items-center justify-center border border-primary-100 shadow-xs">
              <IconAward size={32} />
            </div>

            <div>
              <h3 className="text-xl font-bold font-heading text-neutral-900">
                Certificat Officiel de Dépôt PFE
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 font-body mt-1.5 leading-relaxed">
                Ce document officiel et infalsifiable atteste de la validation pédagogique finale de votre manuscrit de PFE.
                Muni d'un QR code sécurisé, il est exigé par l'administration universitaire pour l'autorisation de dépôt et la programmation de la soutenance.
              </p>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-left text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <IconClock size={16} className="text-amber-600" />
                En attente d'approbation officielle par l'encadreur
              </div>
              <p className="font-body text-neutral-600 leading-relaxed">
                Conformément au règlement académique, aucun certificat officiel ne peut être généré avant que
                l'encadreur universitaire n'accorde formellement sa validation sur la version finale du rapport.
              </p>
            </div>

            {/* Supervisor action button */}
            {isSupervisorOrAdmin && (
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={<IconShield size={18} />}
                  onClick={() => setIsModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Valider Définitivement le PFE & Émettre le Certificat
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* If Certificate is Generated & Validated */}
      {certificate && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
          {/* Top Decorative Banner */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-primary-500 to-indigo-600" />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-neutral-100 pb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200 shadow-xs">
                <IconAward size={32} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-bold font-heading text-neutral-900">
                    Certificat Officiel de Validation & Dépôt
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <IconCheck size={14} className="text-emerald-700" />
                    Validé Officiellement
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500">
                  <span className="flex items-center gap-1 font-mono font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                    {certificate.certificate_id}
                  </span>
                  <button
                    onClick={copyCertId}
                    className="text-primary-600 hover:underline cursor-pointer font-medium"
                  >
                    Copier
                  </button>
                  <span>•</span>
                  <span>Émis le {formatDate(certificate.validation_date)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start">
              <Button
                variant="primary"
                size="md"
                icon={<IconDownload size={18} />}
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isDownloading ? "Génération PDF..." : "Télécharger le Certificat (PDF)"}
              </Button>

              {onOpenVerification && (
                <Button
                  variant="outline"
                  size="md"
                  icon={<IconShield size={18} />}
                  onClick={() => onOpenVerification(certificate.certificate_id)}
                >
                  Page de Vérification
                </Button>
              )}
            </div>
          </div>

          {/* Certificate Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs">
            {/* Student & Project Details */}
            <div className="bg-neutral-50/80 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <span className="font-bold text-neutral-800 uppercase tracking-wider text-[11px] block border-b border-neutral-200 pb-1.5">
                Candidats & Établissement
              </span>

              <div>
                <span className="text-neutral-500 block">Projet de Fin d'Études :</span>
                <strong className="text-neutral-900 text-sm font-semibold">{certificate.project_title}</strong>
              </div>

              <div>
                <span className="text-neutral-500 block">Établissement :</span>
                <strong className="text-neutral-800">{certificate.institution_name}</strong>
              </div>

              <div>
                <span className="text-neutral-500 block">Étudiant(s) / Équipe :</span>
                <div className="mt-1 space-y-1">
                  {certificate.student_names.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-neutral-800 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
                      <span>{name}</span>
                      <span className="text-neutral-400 text-[11px]">({certificate.student_emails[i]})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-neutral-500 block">Version Finale Validée :</span>
                <strong className="text-neutral-800">Version {certificate.version_number} (Manuscrit Déposé)</strong>
              </div>
            </div>

            {/* Supervisor & Decision */}
            <div className="bg-neutral-50/80 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <span className="font-bold text-neutral-800 uppercase tracking-wider text-[11px] block border-b border-neutral-200 pb-1.5">
                Avis de l'Encadrement & Audit
              </span>

              <div>
                <span className="text-neutral-500 block">Encadrant Académique :</span>
                <strong className="text-neutral-900">{certificate.supervisor_name}</strong>
                <span className="text-neutral-500 text-[11px] block">({certificate.supervisor_email})</span>
              </div>

              {certificate.enterprise_supervisor_name && (
                <div>
                  <span className="text-neutral-500 block">Tuteur Entreprise :</span>
                  <strong className="text-neutral-800">{certificate.enterprise_supervisor_name}</strong>
                </div>
              )}

              <div>
                <span className="text-neutral-500 block">Décision Officielle :</span>
                <span className="inline-block mt-0.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {certificate.supervisor_mention || "Favorable pour soutenance"}
                </span>
              </div>

              {/* AI Compliance Score (Optional - Never Fabricated!) */}
              <div>
                <span className="text-neutral-500 block">Audit de Conformité IA :</span>
                {certificate.ai_compliance_score !== null && certificate.ai_compliance_score !== undefined ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                      Score : {certificate.ai_compliance_score}%
                    </span>
                    <span className="text-neutral-600 font-medium">
                      ({certificate.ai_compliance_level || "CONFORME"})
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-500 italic mt-0.5 block">
                    Non requis / Optionnel (avis souverain de l'encadreur)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Legal Notice Framework (Distinguishing digital approval from legal e-signature) */}
          <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <IconLock size={15} className="text-slate-600" />
              Mention Juridique & Intégrité Cryptographique
            </div>
            <p className="text-slate-600 font-body leading-relaxed">
              {certificate.legal_notice}
            </p>
            <div className="pt-1 text-[11px] font-mono text-slate-500 truncate">
              Empreinte SHA-256 : {certificate.certificate_hash}
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Validation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <IconShield size={20} />
                </span>
                <h3 className="text-base font-bold text-neutral-900 font-heading">
                  Validation Finale du PFE & Dépôt
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <IconClose size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed font-body">
              Cette action formelle certifie que le manuscrit final satisfait aux exigences du diplôme
              et autorise le dépôt officiel pour la soutenance.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Version du rapport à valider
                </label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-body"
                >
                  {reports[0]?.versions?.map((v) => (
                    <option key={v.version_number} value={v.version_number}>
                      Version {v.version_number} ({v.original_file_name})
                    </option>
                  )) || <option value={1}>Version 1</option>}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Établissement / Faculté
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Ex : INSAT - Université de Carthage"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-body"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Mention officielle de validation
                </label>
                <select
                  value={mention}
                  onChange={(e) => setMention(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-body"
                >
                  <option value="Très Favorable — Prêt pour Soutenance">Très Favorable — Prêt pour Soutenance</option>
                  <option value="Favorable pour Soutenance">Favorable pour Soutenance</option>
                  <option value="Favorable avec Recommandations Mineures">Favorable avec Recommandations Mineures</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Appréciation finale & Remarques pour l'administration
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Commentaires généraux sur la qualité du manuscrit déposé..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-body"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <strong>Rappel réglementaire :</strong> Cette validation numérique interne atteste de l'autorisation
              de dépôt pédagogique. Un certificat officiel PDF infalsifiable avec QR code sera généré pour l'étudiant.
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isValidating}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<IconCheck size={16} />}
                onClick={handleConfirmValidation}
                disabled={isValidating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isValidating ? "Émission en cours..." : "Confirmer & Émettre le Certificat"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
