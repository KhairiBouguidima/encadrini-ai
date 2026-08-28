import { useEffect, useState } from "react"
import { LandingPage } from "./pages/LandingPage"
import { SignupPage } from "./pages/auth/SignupPage"
import { LoginPage } from "./pages/auth/LoginPage"
import { InvitationPage } from "./pages/auth/InvitationPage"
import { EmailConfirmationPage } from "./pages/auth/EmailConfirmationPage"
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage"
import { StudentDashboard } from "./pages/student/StudentDashboard"
import { ReportVersionDetail } from "./pages/student/ReportVersionDetail"
import { ProfilePage } from "./pages/student/ProfilePage"
import { ReportReviewer } from "./pages/supervisor/ReportReviewer"
import { AIWorkshop } from "./pages/ai-workshop/AIWorkshop"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { clearSession, getStoredUser, SESSION_EXPIRED_EVENT, type User } from "./lib/api"

type Route =
  | "landing"
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "invitation"
  | "email-confirmation"
  | "student-dashboard"
  | "student-version"
  | "supervisor-reviewer"
  | "ai-workshop"
  | "admin-dashboard"
  | "profile"

// Barre de démo permettant de naviguer entre tous les écrans du prototype.
// À retirer (ou remplacer par un vrai routeur + authentification) lors du
// passage à l'implémentation connectée au backend FastAPI.
function DemoSwitcher({ route, onChange }: { route: Route; onChange: (r: Route) => void }) {
  const routes: { key: Route; label: string }[] = [
    { key: "landing", label: "Landing" },
    { key: "signup", label: "Inscription" },
    { key: "login", label: "Connexion" },
    { key: "invitation", label: "Invitation" },
    { key: "email-confirmation", label: "Email" },
    { key: "student-dashboard", label: "Étudiant · Dashboard" },
    { key: "student-version", label: "Étudiant · Version" },
    { key: "supervisor-reviewer", label: "Encadreur · Lecteur" },
    { key: "ai-workshop", label: "Atelier IA" },
    { key: "profile", label: "Profil" },
    { key: "admin-dashboard", label: "Admin" },
  ]
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 text-white flex flex-wrap items-center gap-1 px-3 py-2 text-xs font-body">
      <span className="text-neutral-400 mr-2">Démo —</span>
      {routes.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            route === r.key ? "bg-primary-600" : "hover:bg-neutral-700"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [emailConfirmationToken, setEmailConfirmationToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("confirm_email") ?? ""
  })
  const [resetPasswordToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("reset_token") ?? ""
  })
  const [selectedVersion, setSelectedVersion] = useState("1")
  const [selectedReport, setSelectedReport] = useState("")
  const [route, setRoute] = useState<Route>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("confirm_email")) return "email-confirmation"
    if (params.get("reset_token")) return "reset-password"
    const storedUser = getStoredUser()
    if (storedUser?.role === "STUDENT") return "student-dashboard"
    if (storedUser?.role === "ENCADRER") return "supervisor-reviewer"
    if (storedUser?.role === "ADMIN") return "admin-dashboard"
    return "landing"
  })

  const handleAuthenticated = (nextUser: User) => {
    setUser(nextUser)
    if (nextUser.role === "STUDENT") setRoute("student-dashboard")
    else if (nextUser.role === "ENCADRER") setRoute("supervisor-reviewer")
    else setRoute("admin-dashboard")
  }

  const handleExit = () => {
    clearSession()
    setUser(null)
    setRoute("landing")
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null)
      setRoute("login")
      sessionStorage.setItem("encadrini_login_notice", "Session expirée. Connectez-vous de nouveau.")
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  return (
    <div className="pb-12">
      {route === "landing" && (
        <LandingPage onNavigate={(page) => setRoute(page)} />
      )}
      {route === "login" && (
        <LoginPage onNavigate={(page) => setRoute(page)} onAuthenticated={handleAuthenticated} />
      )}
      {route === "signup" && <SignupPage onNavigate={(page) => setRoute(page)} />}
      {route === "forgot-password" && (
        <ForgotPasswordPage onNavigate={(page) => setRoute(page)} />
      )}
      {route === "reset-password" && (
        <ResetPasswordPage token={resetPasswordToken} onNavigate={(page) => setRoute(page)} />
      )}
      {route === "invitation" && (
        <InvitationPage onAccept={(target) => setRoute(target)} />
      )}
      {route === "email-confirmation" && (
        <EmailConfirmationPage
          token={emailConfirmationToken}
          onGoLogin={() => {
            window.history.replaceState({}, "", window.location.pathname)
            setEmailConfirmationToken("")
            setRoute("login")
          }}
        />
      )}
      {route === "student-dashboard" && (
        <StudentDashboard
          onOpenVersion={(reportId, versionId) => {
            setSelectedReport(reportId)
            setSelectedVersion(versionId)
            setRoute("student-version")
          }}
          onOpenWorkshop={(reportId, versionId) => {
            setSelectedReport(reportId)
            setSelectedVersion(versionId)
            setRoute("ai-workshop")
          }}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "student-version" && (
        <ReportVersionDetail
          onBack={() => setRoute("student-dashboard")}
          onOpenWorkshop={() => setRoute("ai-workshop")}
          onExit={handleExit}
          user={user}
          versionId={selectedVersion}
        />
      )}
      {route === "supervisor-reviewer" && (
        <ReportReviewer onExit={handleExit} user={user} />
      )}
      {route === "ai-workshop" && (
        <AIWorkshop 
          onExit={handleExit} 
          reportId={selectedReport} 
          versionNumber={Number(selectedVersion)} 
          user={user}
        />
      )}
      {route === "admin-dashboard" && (
        <AdminDashboard onExit={handleExit} user={user} />
      )}
      {route === "profile" && (
        <ProfilePage
          user={user}
          onUpdateUser={(updatedUser) => setUser(updatedUser)}
          onNavigate={(target) => setRoute(target as any)}
          onExit={handleExit}
        />
      )}

      <DemoSwitcher route={route} onChange={setRoute} />
    </div>
  )
}
