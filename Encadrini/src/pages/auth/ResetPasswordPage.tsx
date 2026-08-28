import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { api } from "../../lib/api"

export function ResetPasswordPage({
  token,
  onNavigate,
}: {
  token: string
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitReset = async () => {
    setError("")
    setSuccess("")
    setIsSubmitting(true)

    try {
      await api.resetPassword(token, password)
      setSuccess("Mot de passe mis à jour. Vous pouvez maintenant vous connecter.")
      sessionStorage.setItem("encadrini_login_notice", "Mot de passe mis à jour. Connectez-vous à votre compte.")
      setTimeout(() => {
        window.history.replaceState({}, "", window.location.pathname)
        onNavigate("login")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la réinitialisation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <button onClick={() => onNavigate("landing")}>
            <Logo />
          </button>
        </div>
        <Card className="!p-8">
          <h1 className="text-xl font-bold font-display text-neutral-900 mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-neutral-500 font-body mb-6">
            Entrez votre nouveau mot de passe ci-dessous.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitReset()
            }}
          >
            {success && (
              <p className="rounded-lg bg-success-100 px-3 py-2 text-sm text-success-600 font-body">
                {success}
              </p>
            )}

            <Input
              label="Nouveau mot de passe"
              type="password"
              placeholder="8 caractères minimum"
              hint="Utilisez au moins une majuscule, un chiffre et un caractère spécial."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-600 font-body">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" className="mt-2" disabled={isSubmitting || !!success}>
              {isSubmitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </Button>
          </form>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                window.history.replaceState({}, "", window.location.pathname)
                onNavigate("login")
              }}
              className="text-sm text-primary-600 font-medium hover:underline"
            >
              Retour à la connexion
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
