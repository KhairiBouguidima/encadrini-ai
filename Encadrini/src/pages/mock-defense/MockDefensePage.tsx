import { useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { 
  IconStats, IconReport, IconSparkles, IconBell, IconUser, IconAward 
} from "../../components/ui/Icons"
import { type User } from "../../lib/api"
import { MockDefenseLanding } from "./MockDefenseLanding"
import { LiveDefenseSession } from "./LiveDefenseSession"
import { DefenseReportView } from "./DefenseReportView"
import { STUDENT_NAV_ITEMS } from "../../lib/navItems"

export function MockDefensePage({
  onNavigate,
  onExit,
  user,
}: {
  onNavigate: (target: string) => void
  onExit: () => void
  user: User | null
}) {
  const [subRoute, setSubRoute] = useState<"landing" | "session" | "report">("landing")
  const [activeSimulationId, setActiveSimulationId] = useState<string>("")

  const handleNavClick = (key: string) => {
    if (key === "mock-defense") {
      setSubRoute("landing")
    } else {
      onNavigate(key)
    }
  }

  return (
    <AppShell
      navItems={STUDENT_NAV_ITEMS}
      activeKey="mock-defense"
      onNavigate={handleNavClick}
      onExit={onExit}
      userName={user?.full_name || "Étudiant"}
      userRole="Étudiant"
    >
      {subRoute === "landing" && (
        <MockDefenseLanding
          onOpenSimulation={(id) => {
            setActiveSimulationId(id)
            setSubRoute("session")
          }}
          onOpenReport={(id) => {
            setActiveSimulationId(id)
            setSubRoute("report")
          }}
          user={user}
        />
      )}

      {subRoute === "session" && (
        <LiveDefenseSession
          simulationId={activeSimulationId}
          onFinish={(id) => {
            setActiveSimulationId(id)
            setSubRoute("report")
          }}
          onExit={() => setSubRoute("landing")}
          user={user}
        />
      )}

      {subRoute === "report" && (
        <DefenseReportView
          simulationId={activeSimulationId}
          onBack={() => setSubRoute("landing")}
          user={user}
        />
      )}
    </AppShell>
  )
}
