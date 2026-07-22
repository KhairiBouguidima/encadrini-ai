import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { StatusBadge } from "../../components/ui/Badge"
import { IconStats, IconStudent, IconReport, IconSettings, IconSearch } from "../../components/ui/Icons"

const navItems: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble", icon: <IconStats size={18} /> },
  { key: "users", label: "Comptes", icon: <IconStudent size={18} /> },
  { key: "projects", label: "Projets PFE", icon: <IconReport size={18} /> },
  { key: "settings", label: "Paramètres", icon: <IconSettings size={18} /> },
]

const stats = [
  { label: "Projets actifs", value: "128" },
  { label: "Comptes étudiants", value: "412" },
  { label: "Comptes encadreurs", value: "56" },
  { label: "Score de qualité moyen", value: "71/100" },
]

const scoreDistribution = [
  { range: "0-20", count: 3 },
  { range: "21-40", count: 9 },
  { range: "41-60", count: 28 },
  { range: "61-80", count: 54 },
  { range: "81-100", count: 34 },
]

const accounts = [
  { name: "Karim Boumediene", role: "Étudiant", email: "k.boumediene@univ.tn", status: "accepted" as const },
  { name: "Pr. Saïd Amrani", role: "Encadreur", email: "s.amrani@univ.tn", status: "accepted" as const },
  { name: "Amira Cherif", role: "Étudiant", email: "a.cherif@univ.tn", status: "pending" as const },
  { name: "Dr. Houria Telli", role: "Encadreur", email: "h.telli@univ.tn", status: "accepted" as const },
]

const recentProjects = [
  { title: "Détection d'anomalies réseau par apprentissage automatique", student: "Karim Boumediene", status: "analysed" as const },
  { title: "Plateforme IoT pour le suivi agricole", student: "Amira Cherif", status: "reviewing" as const },
  { title: "Optimisation de requêtes NoSQL à grande échelle", student: "Yassine Bel Haj", status: "draft" as const },
]

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  return (
    <AppShell
      navItems={navItems}
      activeKey="overview"
      onNavigate={() => {}}
      onExit={onExit}
      userName="Nadia Ferjani"
      userRole="Administratrice plateforme"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold font-display text-neutral-900">Vue d'ensemble</h1>
          <div className="flex items-center gap-2 border border-neutral-300 rounded-lg px-3 py-2 bg-white w-64">
            <IconSearch size={15} className="text-neutral-400" />
            <input
              placeholder="Rechercher un compte, un projet…"
              className="flex-1 text-sm font-body focus:outline-none"
            />
          </div>
        </div>

        {/* Cartes statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          {stats.map((s) => (
            <Card key={s.label}>
              <p className="text-xs font-medium font-body text-neutral-500 mb-2">{s.label}</p>
              <p className="text-2xl font-bold font-display text-neutral-900">{s.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {/* Répartition des scores */}
          <Card>
            <h2 className="font-semibold font-display text-neutral-800 mb-5">
              Répartition des scores de qualité
            </h2>
            <div className="flex items-end gap-4 h-40">
              {scoreDistribution.map((d) => (
                <div key={d.range} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary-500 rounded-t-md"
                    style={{ height: `${(d.count / 54) * 100}%` }}
                  />
                  <span className="text-[11px] font-body text-neutral-400">{d.range}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Projets récents */}
          <Card padded={false}>
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="font-semibold font-display text-neutral-800">Projets PFE récents</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {recentProjects.map((p) => (
                <div key={p.title} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-body text-neutral-800 truncate">{p.title}</p>
                    <p className="text-xs text-neutral-400 font-body">{p.student}</p>
                  </div>
                  <StatusBadge variant={p.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Gestion des comptes */}
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-semibold font-display text-neutral-800">Gestion des comptes</h2>
          </div>
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                <th className="font-medium px-5 py-3">Nom</th>
                <th className="font-medium px-5 py-3">Rôle</th>
                <th className="font-medium px-5 py-3">Email</th>
                <th className="font-medium px-5 py-3">Statut</th>
                <th className="font-medium px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {accounts.map((a) => (
                <tr key={a.email}>
                  <td className="px-5 py-3.5 text-neutral-800 font-medium">{a.name}</td>
                  <td className="px-5 py-3.5 text-neutral-500">{a.role}</td>
                  <td className="px-5 py-3.5 text-neutral-500">{a.email}</td>
                  <td className="px-5 py-3.5"><StatusBadge variant={a.status} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="text-primary-600 font-medium hover:underline mr-3">Modifier</button>
                    <button className="text-danger-600 font-medium hover:underline">Désactiver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  )
}
