import { useEffect, useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { IconSupervisor, IconCheck } from "../../components/ui/Icons"
import { api, getStoredUser } from "../../lib/api"
import { useToast } from "../../components/ui/Toast"

export function InvitationPage({
  token,
  onAccept,
  onAccepted,
}: {
  token?: string
  onAccept: (target: "signup" | "login", presetEmail?: string) => void
  onAccepted?: () => void
}) {
  const currentUser = getStoredUser()
  const [studentName, setStudentName] = useState("Karim Boumediene")
  const [projectTitle, setProjectTitle] = useState("Projet de Fin d'Études")
  const [encadrerEmail, setEncadrerEmail] = useState("")
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    let isMounted = true
    setIsLoading(true)

    api.previewInvitation(token)
      .then((data) => {
        if (!isMounted) return
        setStudentName(data.student_name)
        setProjectTitle(data.project_title)
        setEncadrerEmail(data.encadrer_email)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Invitation invalide ou expirée.")
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => { isMounted = false }
  }, [token])

  const handleAction = (target: "signup" | "login") => {
    if (token) {
      sessionStorage.setItem("encadrini_pending_invitation_token", token)
    }
    if (encadrerEmail) {
      sessionStorage.setItem("encadrini_pending_invitation_email", encadrerEmail)
    }
    onAccept(target, encadrerEmail)
  }

  const handleDirectAccept = async () => {
    if (!token) return
    setIsAccepting(true)
    setError("")
    try {
      await api.acceptInvitation(token)
      setSuccessMsg("Félicitations ! Vous êtes maintenant en relation avec l'étudiant pour ce projet.")
      setTimeout(() => {
        if (onAccepted) onAccepted()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'accepter l'invitation.")
    } finally {
      setIsAccepting(false)
    }
  }

  const { toast, confirm } = useToast()

  const handleDirectDecline = () => {
    if (!token) return
    confirm({
      title: "Refuser l'invitation ?",
      message: "Êtes-vous certain de vouloir refuser cette invitation de projet PFE ?",
      confirmText: "Refuser l'invitation",
      cancelText: "Annuler",
      variant: "danger",
      onConfirm: async () => {
        setIsDeclining(true)
        setError("")
        try {
          await api.declineInvitation(token)
          setSuccessMsg("L'invitation a été déclinée.")
          toast.info("L'invitation a été refusée.")
          setTimeout(() => {
            if (onAccepted) onAccepted()
          }, 1500)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Impossible de décliner l'invitation."
          setError(msg)
          toast.error(msg)
        } finally {
          setIsDeclining(false)
        }
      },
    })
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Card className="!p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-5">
            <IconSupervisor size={22} className="text-primary-600" />
          </div>

          {isLoading ? (
            <p className="text-sm text-neutral-500 font-body py-4 animate-pulse">Chargement de l'invitation...</p>
          ) : error ? (
            <div>
              <h1 className="text-lg font-bold font-display text-danger-700 mb-2">Invitation</h1>
              <p className="text-sm text-neutral-500 font-body mb-6">{error}</p>
              <Button size="lg" variant="secondary" onClick={() => onAccept("signup")}>
                Créer un compte Encadrini
              </Button>
            </div>
          ) : successMsg ? (
            <div className="py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <IconCheck size={24} />
              </div>
              <h2 className="text-lg font-bold font-display text-emerald-900">Statut mis à jour</h2>
              <p className="text-sm text-neutral-600 font-body">{successMsg}</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold font-display text-neutral-900 mb-2">
                Vous êtes invité(e) à encadrer un projet PFE
              </h1>
              <p className="text-sm text-neutral-600 font-body leading-relaxed mb-1">
                <span className="font-semibold text-neutral-800">{studentName}</span> vous invite à
                encadrer son projet :
              </p>
              <p className="text-sm font-semibold font-body text-primary-700 mb-6">« {projectTitle} »</p>

              {currentUser && currentUser.role === "ENCADRER" ? (
                <div className="space-y-3">
                  <p className="text-xs text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 mb-4">
                    Connecté en tant que : <strong>{currentUser.first_name} {currentUser.last_name}</strong> ({currentUser.email})
                  </p>
                  <Button
                    size="lg"
                    onClick={handleDirectAccept}
                    disabled={isAccepting || isDeclining}
                    className="w-full justify-center"
                  >
                    {isAccepting ? "Acceptation en cours..." : "Accepter l'invitation"}
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={handleDirectDecline}
                    disabled={isAccepting || isDeclining}
                    className="w-full justify-center !text-danger-600 hover:!bg-danger-50"
                  >
                    {isDeclining ? "Refus en cours..." : "Refuser l'invitation"}
                  </Button>
                </div>
              ) : currentUser && currentUser.role === "STUDENT" ? (
                <div className="space-y-4">
                  <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    Vous êtes actuellement connecté avec un compte étudiant ({currentUser.email}). Déconnectez-vous pour accepter en tant qu'encadreur.
                  </p>
                  <Button size="lg" variant="secondary" onClick={() => handleAction("login")}>
                    Se connecter avec un compte Encadreur
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button size="lg" onClick={() => handleAction("signup")}>
                    Accepter et créer un compte
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => handleAction("login")}>
                    Accepter et se connecter
                  </Button>
                </div>
              )}

              <p className="text-xs text-neutral-400 font-body mt-6">
                Ce lien d'invitation est valable pendant 7 jours.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
