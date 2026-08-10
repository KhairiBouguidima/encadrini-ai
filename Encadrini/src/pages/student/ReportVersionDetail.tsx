import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Tag } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconBell, IconChevronRight } from "../../components/ui/Icons"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

const keywords = ["Machine Learning", "Détection d'anomalies", "Sécurité réseau", "Deep Learning", "Big Data"]

const juryQuestions = [
  "Quels jeux de données ont servi à entraîner votre modèle et sont-ils représentatifs du trafic réel ?",
  "Comment votre approche se compare-t-elle aux méthodes de détection par signature classiques ?",
  "Quelles sont les limites de votre modèle face à des attaques inédites (zero-day) ?",
]

const comments = [
  { author: "Pr. Saïd Amrani", date: "19 juil. 2026", page: 12, text: "La méthodologie gagnerait à préciser le protocole d'évaluation croisée." },
  { author: "Pr. Saïd Amrani", date: "19 juil. 2026", page: 24, text: "Bonne synthèse de l'état de l'art, pensez à citer les travaux de 2025." },
]

export function ReportVersionDetail({
  versionLabel = "Version 3",
  score = 82,
  onBack,
  onOpenWorkshop,
  onExit,
}: {
  versionLabel?: string
  score?: number
  onBack: () => void
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
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium font-body text-neutral-500 hover:text-neutral-800 transition-colors mb-6"
        >
          <IconChevronRight size={14} className="rotate-180" /> Retour au tableau de bord
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold font-display text-neutral-900">{versionLabel} — Analyse IA</h1>
          <Button variant="ai" size="sm" icon={<IconSparkles size={14} />} onClick={onOpenWorkshop}>
            Ouvrir l'Atelier IA
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          <Card className="md:col-span-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full border-[6px] border-primary-100 flex items-center justify-center text-primary-700 font-bold font-display text-2xl mb-3">
              {score}
            </div>
            <p className="text-sm font-semibold font-body text-neutral-800">Score de qualité</p>
            <p className="text-xs text-neutral-500 font-body mt-1">Structure · Cohérence · Style</p>
          </Card>

          <Card className="md:col-span-2">
            <h3 className="font-semibold font-display text-neutral-800 mb-2">Résumé généré</h3>
            <p className="text-sm text-neutral-600 font-body leading-relaxed">
              Ce rapport propose une approche de détection d'anomalies dans le trafic réseau basée sur
              l'apprentissage automatique. Après une revue de l'état de l'art, l'étude compare plusieurs
              architectures de modèles avant de proposer une solution hybride évaluée sur un jeu de
              données réel.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {keywords.map((k) => (
                <Tag key={k} label={k} />
              ))}
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Questions de jury anticipées</h3>
            <ul className="space-y-3">
              {juryQuestions.map((q) => (
                <li key={q} className="text-sm text-neutral-600 font-body leading-relaxed pl-3 border-l-2 border-ai-200">
                  {q}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold font-display text-neutral-800 mb-3">Commentaires de l'encadreur</h3>
            <div className="space-y-4">
              {comments.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <Avatar name={c.author} size="sm" />
                  <div>
                    <p className="text-xs text-neutral-400 font-body">Page {c.page} · {c.date}</p>
                    <p className="text-sm text-neutral-700 font-body leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
