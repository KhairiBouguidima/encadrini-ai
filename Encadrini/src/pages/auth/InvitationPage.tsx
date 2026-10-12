import { useEffect, useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { IconSupervisor } from "../../components/ui/Icons"
import { api } from "../../lib/api"

export function InvitationPage({
  token,
  onAccept,
}: {
  token?: string
  onAccept: (target: "signup" | "login", presetEmail?: string) => void
}) {
  const [studentName, setStudentName] = useState("Karim Boumediene")
  const [projectTitle, setProjectTitle] = useState("Projet de Fin d'Études")
  const [encadrerEmail, setEncadrerEmail] = useState("")
  const [isLoading, setIsLoading] = useState(Boolean(token))
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
              <h1 className="text-lg font-bold font-display text-danger-700 mb-2">Invitation invalide</h1>
              <p className="text-sm text-neutral-500 font-body mb-6">{error}</p>
              <Button size="lg" variant="secondary" onClick={() => onAccept("signup")}>
                Créer un compte Encadrini
              </Button>
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
              <p className="text-sm font-medium font-body text-primary-700 mb-6">« {projectTitle} »</p>

              <div className="flex flex-col gap-3">
                <Button size="lg" onClick={() => handleAction("signup")}>
                  Accepter et créer un compte
                </Button>
                <Button size="lg" variant="secondary" onClick={() => handleAction("login")}>
                  Accepter et se connecter
                </Button>
              </div>

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
