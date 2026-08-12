import { useEffect, useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
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
  const [message, setMessage] = useState("Confirmation de votre email...")

  useEffect(() => {
    let isMounted = true

    const confirm = async () => {
      try {
        await api.confirmEmail(token)
        if (!isMounted) return
        setState("success")
        setMessage("Email confirme. Vous pouvez maintenant vous connecter.")
        sessionStorage.setItem("encadrini_login_notice", "Email confirme. Connectez-vous a votre compte.")
      } catch (err) {
        if (!isMounted) return
        setState("error")
        setMessage(err instanceof Error ? err.message : "Lien de confirmation invalide.")
      }
    }

    confirm()
    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Card className="!p-8 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 ${
              state === "error" ? "bg-danger-100 text-danger-600" : "bg-success-100 text-success-600"
            }`}
          >
            <IconCheck size={22} />
          </div>
          <h1 className="text-lg font-bold font-display text-neutral-900 mb-2">
            Confirmation email
          </h1>
          <p className="text-sm text-neutral-600 font-body leading-relaxed mb-6">{message}</p>
          <Button size="lg" fullWidth onClick={onGoLogin} disabled={state === "loading"}>
            Aller a la connexion
          </Button>
        </Card>
      </div>
    </div>
  )
}
