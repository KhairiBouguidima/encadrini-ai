import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { api, saveSession, type User } from "../../lib/api"

export function LoginPage({
  onNavigate,
  onAuthenticated,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
  onAuthenticated: (user: User) => void
}) {
  const [notice, setNotice] = useState(() => {
    const storedNotice = sessionStorage.getItem("encadrini_login_notice") ?? ""
    sessionStorage.removeItem("encadrini_login_notice")
    return storedNotice
  })
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitLogin = async () => {
    setError("")
    setNotice("")
    setIsSubmitting(true)

    try {
      const session = await api.login(email, password)
      saveSession(session)
      onAuthenticated(session.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible pour le moment.")
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
          <h1 className="text-xl font-bold font-display text-neutral-900 mb-1">Connexion</h1>
          <p className="text-sm text-neutral-500 font-body mb-6">
            Accedez a votre espace Encadrini.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitLogin()
            }}
          >
            {notice && (
              <p className="rounded-lg bg-success-100 px-3 py-2 text-sm text-success-600 font-body">
                {notice}
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
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neutral-700 font-body">Mot de passe</span>
                <button type="button" className="text-xs text-primary-600 font-body hover:underline">
                  Mot de passe oublie ?
                </button>
              </div>
              <Input
                placeholder="********"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-600 font-body">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <p className="text-sm text-neutral-500 font-body text-center mt-6">
            Pas encore de compte ?{" "}
            <button
              onClick={() => onNavigate("signup")}
              className="text-primary-600 font-medium hover:underline"
            >
              Creer un compte
            </button>
          </p>
        </Card>
      </div>
    </div>
  )
}
