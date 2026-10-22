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
import { MockDefensePage } from "./pages/mock-defense/MockDefensePage"
import { ComplianceCheckerPage } from "./pages/compliance/ComplianceCheckerPage"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { CertificateVerificationPage } from "./pages/certificates/CertificateVerificationPage"
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
  | "mock-defense"
  | "compliance"
  | "profile"
  | "notifications"
  | "verify-certificate"

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
  const [certificateIdParam] = useState(() => {
    return new URLSearchParams(window.location.search).get("cert_id") ?? ""
  })
  const [selectedVersion, setSelectedVersion] = useState("1")
  const [selectedReport, setSelectedReport] = useState("")
  const [route, setRoute] = useState<Route>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("cert_id")) return "verify-certificate"
    if (params.get("confirm_email")) return "email-confirmation"
    if (params.get("reset_token")) return "reset-password"
    if (params.get("invitation_token")) return "invitation"
    const storedUser = getStoredUser()
    if (storedUser?.role === "STUDENT") return "student-dashboard"
    if (storedUser?.role === "ENCADRER") return "supervisor-reviewer"
    if (storedUser?.role === "ADMIN") return "admin-dashboard"
    return "landing"
  })
  const [adminTab, setAdminTab] = useState<"overview" | "users" | "projects">("overview")
  const [supervisorInitialTab, setSupervisorInitialTab] = useState<"reports" | "meetings" | "certificate">("reports")

  const handleGlobalNavigate = (target: string) => {
    if (user?.role === "ADMIN") {
      if (target === "overview" || target === "users" || target === "projects") {
        setAdminTab(target)
        setRoute("admin-dashboard")
        return
      }
      if (target === "dashboard") {
        setAdminTab("overview")
        setRoute("admin-dashboard")
        return
      }
      if (target === "notifications" || target === "profile") {
        setRoute(target as any)
        return
      }
    }
    if (target === "dashboard") {
      setRoute(user?.role === "ENCADRER" ? "supervisor-reviewer" : user?.role === "ADMIN" ? "admin-dashboard" : "student-dashboard")
    } else if (target === "workshop") {
      setRoute("ai-workshop")
    } else if (target === "reports") {
      setRoute(user?.role === "STUDENT" ? "student-reports" : "supervisor-reviewer")
    } else if (target === "mock-defense") {
      setRoute("mock-defense")
    } else if (target === "compliance") {
      setRoute("compliance")
    } else if (target === "verify-certificate") {
      setRoute("verify-certificate")
    } else if (target === "meetings" || target === "certificate") {
      // meetings & certificate are sub-tabs of the main role dashboard
      if (user?.role === "ENCADRER") {
        setSupervisorInitialTab(target as "meetings" | "certificate")
        setRoute("supervisor-reviewer")
      } else {
        setRoute("student-dashboard")
      }
    } else {
      setRoute(target as any)
    }
  }

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
          onAccepted={() => {
            window.history.replaceState({}, "", window.location.pathname)
            const u = getStoredUser()
            setUser(u)
            setRoute(u?.role === "ENCADRER" ? "supervisor-reviewer" : "student-dashboard")
          }}
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
          onNavigate={handleGlobalNavigate}
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
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "student-version" && (
        <ReportVersionDetail
          onBack={() => setRoute("student-dashboard")}
          onOpenWorkshop={() => setRoute("ai-workshop")}
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
          versionId={selectedVersion}
        />
      )}
      {route === "supervisor-reviewer" && (
        <ReportReviewer
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
          initialTab={supervisorInitialTab}
          onTabChange={() => setSupervisorInitialTab("reports")}
        />
      )}
      {route === "ai-workshop" && (
        <AIWorkshop 
          onNavigate={handleGlobalNavigate}
          onExit={handleExit} 
          reportId={selectedReport} 
          versionNumber={Number(selectedVersion)} 
          user={user}
        />
      )}
      {route === "mock-defense" && (
        <MockDefensePage
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "compliance" && (
        <ComplianceCheckerPage
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
        />
      )}
      {route === "admin-dashboard" && (
        <AdminDashboard
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
          user={user}
          initialTab={adminTab}
        />
      )}
      {route === "profile" && (
        <ProfilePage
          user={user}
          onUpdateUser={(updatedUser) => setUser(updatedUser)}
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
        />
      )}
      {route === "notifications" && (
        <NotificationsPage
          user={user}
          onNavigate={handleGlobalNavigate}
          onExit={handleExit}
        />
      )}
      {route === "verify-certificate" && (
        <CertificateVerificationPage
          initialCertId={certificateIdParam}
          onGoHome={() => {
            if (user?.role === "STUDENT") setRoute("student-dashboard")
            else if (user?.role === "ENCADRER") setRoute("supervisor-reviewer")
            else if (user?.role === "ADMIN") setRoute("admin-dashboard")
            else setRoute("landing")
          }}
        />
      )}
    </div>
  )
}
