import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { api } from "../../lib/api"

export function ForgotPasswordPage({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitForgot = async () => {
    setError("")
    setSuccess("")
    setIsSubmitting(true)

    try {
      await api.forgotPassword(email)
      setSuccess("Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la demande.")
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
          <h1 className="text-xl font-bold font-display text-neutral-900 mb-1">Mot de passe oublié</h1>
          <p className="text-sm text-neutral-500 font-body mb-6">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitForgot()
            }}
          >
            {success && (
              <p className="rounded-lg bg-success-100 px-3 py-2 text-sm text-success-600 font-body">
                {success}
              </p>
            )}

            <Input
              label="Adresse email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-600 font-body">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => onNavigate("login")}
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
