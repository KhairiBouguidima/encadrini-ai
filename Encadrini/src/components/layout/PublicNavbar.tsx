import logoImg from "../../assets/logo.png"
import { Button } from "../ui/Button"

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src={logoImg} alt="Encadrini" className="h-15 w-auto" />
      
    </div>
  )
}

export function PublicNavbar({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <button onClick={() => onNavigate("landing")} className="cursor-pointer">
          <Logo />
        </button>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium font-body text-neutral-600">
          <a href="#fonctionnalites" className="hover:text-neutral-900 transition-colors">Fonctionnalités</a>
          <a href="#atelier-ia" className="hover:text-neutral-900 transition-colors">Atelier IA</a>
          <a href="#a-propos" className="hover:text-neutral-900 transition-colors">À propos</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onNavigate("login")}>
            Connexion
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate("signup")}>
            Créer un compte
          </Button>
        </div>
      </div>
    </header>
  )
}