import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { api, saveSession, type User } from "../../lib/api"

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: "", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

export function SignupPage({
  initialRole,
  initialEmail,
  onNavigate,
  onAuthenticated,
}: {
  initialRole?: "STUDENT" | "ENCADRER"
  initialEmail?: string
  onNavigate: (page: "landing" | "login" | "signup") => void
  onAuthenticated?: (user: User) => void
}) {
  const [fullName, setFullName] = useState("")
  const [faculty, setFaculty] = useState("")
  const [gender, setGender] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [role, setRole] = useState<"STUDENT" | "ENCADRER">(() => {
    if (initialRole) return initialRole
    if (sessionStorage.getItem("encadrini_pending_invitation_token")) return "ENCADRER"
    return "STUDENT"
  })
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail
    return sessionStorage.getItem("encadrini_pending_invitation_email") ?? ""
  })
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showConfirmationNotice, setShowConfirmationNotice] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")

  const submitSignup = async () => {
    setError("")
    setIsSubmitting(true)

    try {
      const name = splitFullName(fullName)
      if (!name.first_name) {
        throw new Error("Veuillez saisir votre nom complet.")
      }
      if (!email.trim()) {
        throw new Error("Veuillez saisir votre adresse email.")
      }
      if (!password) {
        throw new Error("Veuillez choisir un mot de passe.")
      }

      const session = await api.register({
        email: email.trim().toLowerCase(),
        password,
        first_name: name.first_name,
        last_name: name.last_name,
        faculty: faculty.trim(),
        gender: gender.trim(),
        phone_number: phoneNumber.trim(),
        role,
      })

      if (session?.access_token && session?.user?.is_active && onAuthenticated) {
        saveSession(session)
        onAuthenticated(session.user)
      } else {
        // Account created but email confirmation required
        setRegisteredEmail(email.trim().toLowerCase())
        setShowConfirmationNotice(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible pour le moment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const [resendStatus, setResendStatus] = useState("")
  const [isResending, setIsResending] = useState(false)

  const handleResend = async () => {
    setIsResending(true)
    setResendStatus("")
    try {
      const res = await api.resendConfirmation(registeredEmail)
      setResendStatus(res.message)
    } catch {
      setResendStatus("Erreur lors du renvoi. Réessayez plus tard.")
    } finally {
      setIsResending(false)
    }
  }

  if (showConfirmationNotice) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>
          <Card className="!p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <h1 className="text-lg font-bold font-display text-neutral-900 mb-2">
              Vérifiez votre boîte email
            </h1>
            <p className="text-sm text-neutral-600 font-body leading-relaxed mb-2">
              Un email de confirmation a été envoyé à <strong>{registeredEmail}</strong>.
            </p>
            <p className="text-sm text-neutral-500 font-body leading-relaxed mb-6">
              Cliquez sur le lien dans l'email pour activer votre compte. Le lien expire dans 24 heures.
            </p>

            {resendStatus && (
              <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 font-body mb-4">
                {resendStatus}
              </p>
            )}

            <Button
              size="lg"
              fullWidth
              variant="secondary"
              onClick={handleResend}
              disabled={isResending}
              className="mb-3"
            >
              {isResending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
            </Button>
            <Button size="lg" fullWidth onClick={() => onNavigate("login")}>
              Aller à la connexion
            </Button>
          </Card>
        </div>
      </div>
    )
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
          <h1 className="text-xl font-bold font-display text-neutral-900 mb-1">Créer un compte</h1>
          <p className="text-sm text-neutral-500 font-body mb-6">
            Rejoignez Encadrini pour suivre votre PFE ou vos étudiants.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitSignup()
            }}
          >
            <Input
              label="Nom complet"
              type="text"
              placeholder="Karim Boumediene"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              label="Faculté"
              type="text"
              placeholder="Faculté des sciences"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                  Genre
                </span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition"
                >
                  <option value="">Choisir</option>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                  Rôle
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "STUDENT" | "ENCADRER")}
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition"
                >
                  <option value="STUDENT">Étudiant</option>
                  <option value="ENCADRER">Encadreur</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Téléphone"
                type="tel"
                placeholder="+216 12 345 678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </div>
            <Input
              label="Adresse email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="8 caractères minimum"
              hint="Au moins une majuscule, une minuscule et un chiffre."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-600 font-body">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Création..." : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-sm text-neutral-500 font-body text-center mt-6">
            Déjà inscrit ?{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-primary-600 font-medium hover:underline"
            >
              Se connecter
            </button>
          </p>
        </Card>
      </div>
    </div>
  )
}
