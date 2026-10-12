import { useEffect, useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { IconCheck } from "../../components/ui/Icons"
import { api } from "../../lib/api"

type ConfirmationState = "loading" | "success" | "error"

export function EmailConfirmationPage({
  token,
  onGoLogin,
}: {
  token: string
  onGoLogin: () => void
}) {
  const [state, setState] = useState<ConfirmationState>("loading")
  const [message, setMessage] = useState("Confirmation de votre email en cours...")

  // Resend state
  const [resendEmail, setResendEmail] = useState("")
  const [resendStatus, setResendStatus] = useState("")
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    let isMounted = true

    const confirm = async () => {
      try {
        const res = await api.confirmEmail(token)
        if (!isMounted) return
        setState("success")
        setMessage(res.message || "Email confirmé avec succès ! Vous pouvez maintenant vous connecter.")
        sessionStorage.setItem("encadrini_login_notice", "Email confirmé. Connectez-vous à votre compte.")
      } catch (err) {
        if (!isMounted) return
        setState("error")
        setMessage(err instanceof Error ? err.message : "Lien de confirmation invalide ou expiré.")
      }
    }

    confirm()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleResend = async () => {
    if (!resendEmail.trim()) {
      setResendStatus("Veuillez saisir votre adresse email.")
      return
    }
    setIsResending(true)
    setResendStatus("")
    try {
      const res = await api.resendConfirmation(resendEmail.trim())
      setResendStatus(res.message)
    } catch {
      setResendStatus("Erreur lors du renvoi. Réessayez plus tard.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Card className="!p-8 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 ${
              state === "error" ? "bg-danger-100 text-danger-600" : state === "success" ? "bg-success-100 text-success-600" : "bg-neutral-100 text-neutral-400"
            }`}
          >
            {state === "loading" ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <IconCheck size={22} />
            )}
          </div>
          <h1 className="text-lg font-bold font-display text-neutral-900 mb-2">
            {state === "success" ? "Email confirmé !" : state === "error" ? "Échec de la confirmation" : "Confirmation en cours..."}
          </h1>
          <p className="text-sm text-neutral-600 font-body leading-relaxed mb-6">{message}</p>

          {state === "error" && (
            <div className="border-t border-neutral-200 pt-5 mt-2 space-y-3">
              <p className="text-sm text-neutral-500 font-body mb-2">
                Lien expiré ou invalide ? Demandez un nouvel email de confirmation :
              </p>
              <Input
                type="email"
                placeholder="Votre adresse email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              {resendStatus && (
                <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 font-body">
                  {resendStatus}
                </p>
              )}
              <Button
                size="md"
                fullWidth
                variant="secondary"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
              </Button>
            </div>
          )}

          <Button size="lg" fullWidth onClick={onGoLogin} disabled={state === "loading"} className={state === "error" ? "mt-4" : ""}>
            Aller à la connexion
          </Button>
        </Card>
      </div>
    </div>
  )
}
