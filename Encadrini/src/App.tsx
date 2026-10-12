import { useEffect, useState } from "react"
import { LandingPage } from "./pages/LandingPage"
import { SignupPage } from "./pages/auth/SignupPage"
import { LoginPage } from "./pages/auth/LoginPage"
import { InvitationPage } from "./pages/auth/InvitationPage"
import { EmailConfirmationPage } from "./pages/auth/EmailConfirmationPage"
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage"
import { StudentDashboard } from "./pages/student/StudentDashboard"
import { StudentReportsPage } from "./pages/student/StudentReportsPage"
import { ReportVersionDetail } from "./pages/student/ReportVersionDetail"
import { ProfilePage } from "./pages/student/ProfilePage"
import { NotificationsPage } from "./pages/NotificationsPage"
import { ReportReviewer } from "./pages/supervisor/ReportReviewer"
import { AIWorkshop } from "./pages/ai-workshop/AIWorkshop"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { api, clearSession, getStoredUser, SESSION_EXPIRED_EVENT, type User } from "./lib/api"

type Route =
  | "landing"
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "invitation"
  | "email-confirmation"
  | "student-dashboard"
  | "student-reports"
  | "student-version"
  | "supervisor-reviewer"
  | "ai-workshop"
  | "admin-dashboard"
  | "profile"
  | "notifications"

export default function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [emailConfirmationToken, setEmailConfirmationToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("confirm_email") ?? ""
  })
  const [resetPasswordToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("reset_token") ?? ""
  })
  const [invitationToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("invitation_token") ?? ""
  })
  const [selectedVersion, setSelectedVersion] = useState("1")
  const [selectedReport, setSelectedReport] = useState("")
  const [route, setRoute] = useState<Route>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("confirm_email")) return "email-confirmation"
    if (params.get("reset_token")) return "reset-password"
    if (params.get("invitation_token")) return "invitation"
    const storedUser = getStoredUser()
    if (storedUser?.role === "STUDENT") return "student-dashboard"
    if (storedUser?.role === "ENCADRER") return "supervisor-reviewer"
    if (storedUser?.role === "ADMIN") return "admin-dashboard"
    return "landing"
  })

  const handleAuthenticated = async (nextUser: User) => {
    setUser(nextUser)
    
    // Auto-accept invitation if logging in or signing up as ENCADRER with pending token
    const pendingToken = sessionStorage.getItem("encadrini_pending_invitation_token") || invitationToken
    if (nextUser.role === "ENCADRER" && pendingToken) {
      try {
        await api.acceptInvitation(pendingToken)
        sessionStorage.removeItem("encadrini_pending_invitation_token")
        sessionStorage.removeItem("encadrini_pending_invitation_email")
      } catch (err) {
        console.error("Failed to accept invitation:", err)
      }
    }

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
      {route === "signup" && (
        <SignupPage onNavigate={(page) => setRoute(page)} onAuthenticated={handleAuthenticated} />
      )}
      {route === "forgot-password" && (
        <ForgotPasswordPage onNavigate={(page) => setRoute(page)} />
      )}
      {route === "reset-password" && (
        <ResetPasswordPage token={resetPasswordToken} onNavigate={(page) => setRoute(page)} />
      )}
      {route === "invitation" && (
        <InvitationPage
          token={invitationToken}
          onAccept={(target) => setRoute(target)}
        />
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
          onNavigate={(target) => {
            if (target === "dashboard") setRoute("student-dashboard")
            else if (target === "reports") setRoute("student-reports")
            else if (target === "workshop") setRoute("ai-workshop")
            else setRoute(target as any)
          }}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "student-reports" && (
        <StudentReportsPage
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
          onNavigate={(target) => {
            if (target === "dashboard") setRoute("student-dashboard")
            else if (target === "reports") setRoute("student-reports")
            else if (target === "workshop") setRoute("ai-workshop")
            else setRoute(target as any)
          }}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "student-version" && (
        <ReportVersionDetail
          onBack={() => setRoute("student-dashboard")}
          onOpenWorkshop={() => setRoute("ai-workshop")}
          onNavigate={(target) => {
            if (target === "dashboard") setRoute("student-dashboard")
            else if (target === "reports") setRoute("student-reports")
            else if (target === "workshop") setRoute("ai-workshop")
            else setRoute(target as any)
          }}
          onExit={handleExit}
          user={user}
          versionId={selectedVersion}
        />
      )}
      {route === "supervisor-reviewer" && (
        <ReportReviewer
          onNavigate={(target) => {
            if (target === "reports") setRoute("supervisor-reviewer")
            else if (target === "workshop") setRoute("ai-workshop")
            else setRoute(target as any)
          }}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "ai-workshop" && (
        <AIWorkshop 
          onNavigate={(target) => {
            if (target === "dashboard") {
              setRoute(user?.role === "ENCADRER" ? "supervisor-reviewer" : user?.role === "ADMIN" ? "admin-dashboard" : "student-dashboard")
            } else if (target === "workshop") {
              setRoute("ai-workshop")
            } else {
              setRoute(target as any)
            }
          }}
          onExit={handleExit} 
          reportId={selectedReport} 
          versionNumber={Number(selectedVersion)} 
          user={user}
        />
      )}
      {route === "admin-dashboard" && (
        <AdminDashboard
          onNavigate={(target) => {
            if (target === "overview") setRoute("admin-dashboard")
            else setRoute(target as any)
          }}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "profile" && (
        <ProfilePage
          user={user}
          onUpdateUser={(updatedUser) => setUser(updatedUser)}
          onNavigate={(target) => {
            if (target === "dashboard") {
              setRoute(user?.role === "ENCADRER" ? "supervisor-reviewer" : user?.role === "ADMIN" ? "admin-dashboard" : "student-dashboard")
            } else if (target === "workshop") {
              setRoute("ai-workshop")
            } else {
              setRoute(target as any)
            }
          }}
          onExit={handleExit}
        />
      )}
      {route === "notifications" && (
        <NotificationsPage
          user={user}
          onNavigate={(target) => {
            if (target === "dashboard") {
              setRoute(user?.role === "ENCADRER" ? "supervisor-reviewer" : user?.role === "ADMIN" ? "admin-dashboard" : "student-dashboard")
            } else if (target === "workshop") {
              setRoute("ai-workshop")
            } else {
              setRoute(target as any)
            }
          }}
          onExit={handleExit}
        />
      )}
    </div>
  )
}
