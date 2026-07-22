import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import { IconReport, IconSparkles, IconUpload, IconBell, IconChevronRight } from "../../components/ui/Icons"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

interface ReportVersion {
  id: string
  version: number
  date: string
  status: BadgeVariant
  score: number | null
}

const versions: ReportVersion[] = [
  { id: "v3", version: 3, date: "18 juil. 2026", status: "analysed", score: 82 },
  { id: "v2", version: 2, date: "02 juil. 2026", status: "analysed", score: 68 },
  { id: "v1", version: 1, date: "20 juin 2026", status: "analysed", score: 54 },
]

export function StudentDashboard({
  onOpenVersion,
  onOpenWorkshop,
  onExit,
}: {
  onOpenVersion: (versionId: string) => void
  onOpenWorkshop: () => void
  onExit: () => void
}) {
  return (
    <AppShell
      navItems={navItems}
      activeKey="dashboard"
      onNavigate={(key) => key === "workshop" && onOpenWorkshop()}
      onExit={onExit}
      userName="Karim Boumediene"
      userRole="Étudiant · M2 informatique"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">
              Détection d'anomalies réseau par apprentissage automatique
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1">Projet PFE · Génie informatique</p>
          </div>
          <Avatar name="Pr. Saïd Amrani" role="Encadreur associé" size="md" />
        </div>

        {/* Dépôt de rapport */}
        <Card className="mb-8">
          <h2 className="font-semibold font-display text-neutral-800 mb-4">Déposer une nouvelle version</h2>
          <div className="border-2 border-dashed border-neutral-300 rounded-xl py-10 flex flex-col items-center justify-center text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer">
            <div className="w-11 h-11 rounded-full bg-primary-50 flex items-center justify-center mb-3">
              <IconUpload size={20} className="text-primary-600" />
            </div>
            <p className="text-sm font-medium font-body text-neutral-700">
              Glissez-déposez votre fichier ici, ou cliquez pour parcourir
            </p>
            <p className="text-xs text-neutral-400 font-body mt-1">Formats acceptés : PDF, DOCX — 20 Mo max</p>
          </div>
        </Card>

        {/* Historique des versions */}
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-neutral-200">
            <h2 className="font-semibold font-display text-neutral-800">Historique des versions</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => onOpenVersion(v.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-sm font-semibold font-display text-neutral-600">
                    v{v.version}
                  </div>
                  <div>
                    <p className="text-sm font-medium font-body text-neutral-800">Version {v.version}</p>
                    <p className="text-xs text-neutral-400 font-body">Déposée le {v.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {v.score !== null && (
                    <span className="text-sm font-semibold font-display text-primary-700">
                      {v.score}/100
                    </span>
                  )}
                  <StatusBadge variant={v.status} />
                  <IconChevronRight size={16} className="text-neutral-300" />
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="flex justify-end mt-6">
          <Button variant="ai" icon={<IconSparkles size={16} />} onClick={onOpenWorkshop}>
            Ouvrir l'Atelier IA
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
