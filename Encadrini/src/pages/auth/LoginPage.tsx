import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card, Input } from "../../components/ui/Primitives"

export function LoginPage({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
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
            Accédez à votre espace Encadrini.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <Input label="Adresse email" type="email" placeholder="vous@exemple.com" required />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neutral-700 font-body">Mot de passe</span>
                <button type="button" className="text-xs text-primary-600 font-body hover:underline">
                  Mot de passe oublié ?
                </button>
              </div>
              <Input placeholder="••••••••" type="password" required />
            </div>

            <Button type="submit" fullWidth size="lg" className="mt-2">
              Se connecter
            </Button>
          </form>

          <p className="text-sm text-neutral-500 font-body text-center mt-6">
            Pas encore de compte ?{" "}
            <button
              onClick={() => onNavigate("signup")}
              className="text-primary-600 font-medium hover:underline"
            >
              Créer un compte
            </button>
          </p>
        </Card>
      </div>
    </div>
  )
}
