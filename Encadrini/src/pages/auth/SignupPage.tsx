import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { api } from "../../lib/api"

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" ") || parts[0] || "",
  }
}

export function SignupPage({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  const [fullName, setFullName] = useState("")
  const [faculty, setFaculty] = useState("")
  const [gender, setGender] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitSignup = async () => {
    setError("")
    setIsSubmitting(true)

    try {
      const name = splitFullName(fullName)
      if (!name.first_name || !name.last_name) {
        throw new Error("Entrez votre nom complet.")
      }

      await api.register({
        email,
        password,
        first_name: name.first_name,
        last_name: name.last_name,
        faculty,
        gender,
        phone_number: phoneNumber,
      })

      sessionStorage.setItem(
        "encadrini_login_notice",
        "Compte cree. Verifiez votre email pour confirmer le compte avant connexion.",
      )
      onNavigate("login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible pour le moment.")
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
          <h1 className="text-xl font-bold font-display text-neutral-900 mb-1">Creer un compte</h1>
          <p className="text-sm text-neutral-500 font-body mb-6">
            Rejoignez Encadrini pour suivre votre PFE ou vos etudiants.
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
              label="Faculte"
              type="text"
              placeholder="Faculte des sciences"
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
              <Input
                label="Telephone"
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
              placeholder="8 caracteres minimum"
              hint="Utilisez au moins une majuscule, un chiffre et un caractere special."
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
              {isSubmitting ? "Creation..." : "Creer mon compte"}
            </Button>
          </form>

          <p className="text-sm text-neutral-500 font-body text-center mt-6">
            Deja inscrit ?{" "}
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
