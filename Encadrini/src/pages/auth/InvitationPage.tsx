import { Logo } from "../../components/layout/PublicNavbar"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { IconSupervisor } from "../../components/ui/Icons"

export function InvitationPage({
  studentName = "Karim Boumediene",
  projectTitle = "Détection d'anomalies réseau par apprentissage automatique",
  onAccept,
}: {
  studentName?: string
  projectTitle?: string
  onAccept: (target: "signup" | "login") => void
}) {
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
          <h1 className="text-lg font-bold font-display text-neutral-900 mb-2">
            Vous êtes invité(e) à encadrer un projet PFE
          </h1>
          <p className="text-sm text-neutral-600 font-body leading-relaxed mb-1">
            <span className="font-semibold text-neutral-800">{studentName}</span> vous invite à
            encadrer son projet :
          </p>
          <p className="text-sm font-medium font-body text-primary-700 mb-6">« {projectTitle} »</p>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={() => onAccept("signup")}>
              Accepter et créer un compte
            </Button>
            <Button size="lg" variant="secondary" onClick={() => onAccept("login")}>
              Accepter et se connecter
            </Button>
          </div>

          <p className="text-xs text-neutral-400 font-body mt-6">
            Ce lien d'invitation est valable pour une durée limitée.
          </p>
        </Card>
      </div>
    </div>
  )
}
