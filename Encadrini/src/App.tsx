import { useState } from "react"
import { LandingPage } from "./pages/LandingPage"
import { SignupPage } from "./pages/auth/SignupPage"
import { LoginPage } from "./pages/auth/LoginPage"
import { InvitationPage } from "./pages/auth/InvitationPage"
import { StudentDashboard } from "./pages/student/StudentDashboard"
import { ReportVersionDetail } from "./pages/student/ReportVersionDetail"
import { ReportReviewer } from "./pages/supervisor/ReportReviewer"
import { AIWorkshop } from "./pages/ai-workshop/AIWorkshop"
import { AdminDashboard } from "./pages/admin/AdminDashboard"

type Route =
  | "landing"
  | "login"
  | "signup"
  | "invitation"
  | "student-dashboard"
  | "student-version"
  | "supervisor-reviewer"
  | "ai-workshop"
  | "admin-dashboard"

// Barre de démo permettant de naviguer entre tous les écrans du prototype.
// À retirer (ou remplacer par un vrai routeur + authentification) lors du
// passage à l'implémentation connectée au backend FastAPI.
function DemoSwitcher({ route, onChange }: { route: Route; onChange: (r: Route) => void }) {
  const routes: { key: Route; label: string }[] = [
    { key: "landing", label: "Landing" },
    { key: "signup", label: "Inscription" },
    { key: "login", label: "Connexion" },
    { key: "invitation", label: "Invitation" },
    { key: "student-dashboard", label: "Étudiant · Dashboard" },
    { key: "student-version", label: "Étudiant · Version" },
    { key: "supervisor-reviewer", label: "Encadreur · Lecteur" },
    { key: "ai-workshop", label: "Atelier IA" },
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
  const [route, setRoute] = useState<Route>("landing")

  return (
    <div className="pb-12">
      {route === "landing" && (
        <LandingPage onNavigate={(page) => setRoute(page)} />
      )}
      {route === "login" && <LoginPage onNavigate={(page) => setRoute(page)} />}
      {route === "signup" && <SignupPage onNavigate={(page) => setRoute(page)} />}
      {route === "invitation" && (
        <InvitationPage onAccept={(target) => setRoute(target)} />
      )}
      {route === "student-dashboard" && (
        <StudentDashboard
          onOpenVersion={() => setRoute("student-version")}
          onOpenWorkshop={() => setRoute("ai-workshop")}
          onExit={() => setRoute("landing")}
        />
      )}
      {route === "student-version" && (
        <ReportVersionDetail
          onBack={() => setRoute("student-dashboard")}
          onOpenWorkshop={() => setRoute("ai-workshop")}
          onExit={() => setRoute("landing")}
        />
      )}
      {route === "supervisor-reviewer" && (
        <ReportReviewer onExit={() => setRoute("landing")} />
      )}
      {route === "ai-workshop" && <AIWorkshop onExit={() => setRoute("landing")} />}
      {route === "admin-dashboard" && (
        <AdminDashboard onExit={() => setRoute("landing")} />
      )}

      <DemoSwitcher route={route} onChange={setRoute} />
    </div>
  )
}
