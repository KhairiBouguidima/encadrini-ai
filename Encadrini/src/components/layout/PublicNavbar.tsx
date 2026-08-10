import logoImg from "../../assets/logo.png"
import { Button } from "../ui/Button"

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src={logoImg} alt="Encadrini" className="h-9 w-auto" />
      
    </div>
  )
}


export function PublicNavbar({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  return (
    <header className="sticky top-4 z-20 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 rounded-full border border-neutral-200 bg-white/90 backdrop-blur shadow-sm px-3 py-2">
        {/* Logo */}
        <button
          onClick={() => onNavigate("landing")}
          className="cursor-pointer"
        >
          <Logo />
        </button>

        {/* Liens de navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium font-body text-neutral-600">
          <a href="#fonctionnalites" className="hover:text-neutral-900 transition-colors">
            Fonctionnalités
          </a>
          <a href="#atelier-ia" className="hover:text-neutral-900 transition-colors">
            Atelier IA
          </a>
          <a href="#a-propos" className="hover:text-neutral-900 transition-colors">
            À propos
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => onNavigate("login")}
          >
            Connexion
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="rounded-full"
            onClick={() => onNavigate("signup")}
          >
            Créer un compte
          </Button>
        </div>
      </div>
    </header>
  )
}