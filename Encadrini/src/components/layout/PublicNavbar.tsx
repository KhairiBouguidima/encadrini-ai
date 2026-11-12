import logoImg from "../../assets/logo.png"
import { Button } from "../ui/Button"
import { IconSun, IconMoon } from "../ui/Icons"
import { useTheme } from "../../lib/ThemeContext"

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
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-4 z-20 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 rounded-full border border-neutral-200 dark:border-neutral-300 bg-white/90 dark:bg-neutral-100/90 backdrop-blur shadow-sm px-3 py-2">
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
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
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
