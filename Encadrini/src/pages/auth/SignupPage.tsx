import { useState } from "react"
import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"
import { IconStudent, IconSupervisor } from "../../components/ui/Icons"

type Role = "student" | "supervisor"

export function SignupPage({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  const [role, setRole] = useState<Role>("student")

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
            }}
          >
            <div>
              <span className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
                Je suis
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium font-body transition-colors ${
                    role === "student"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <IconStudent size={16} /> Étudiant
                </button>
                <button
                  type="button"
                  onClick={() => setRole("supervisor")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium font-body transition-colors ${
                    role === "supervisor"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <IconSupervisor size={16} /> Encadreur
                </button>
              </div>
            </div>

            <Input label="Nom complet" type="text" placeholder="Karim Boumediene" required />
            <Input label="Adresse email" type="email" placeholder="vous@exemple.com" required />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="8 caractères minimum"
              hint="Utilisez au moins une majuscule, un chiffre et un caractère spécial."
              required
            />

            <Button type="submit" fullWidth size="lg" className="mt-2">
              Créer mon compte
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
