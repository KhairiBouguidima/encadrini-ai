import { PublicNavbar } from "../components/layout/PublicNavbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Primitives"
import { IconReport, IconStudent, IconSupervisor, IconSparkles, IconUpload, IconCheck } from "../components/ui/Icons"

const problems = [
  {
    title: "Retours tardifs",
    text: "L'étudiant ne reçoit un retour structuré qu'au moment des relectures ponctuelles de l'encadreur.",
  },
  {
    title: "Pas de centralisation",
    text: "Les échanges se font par email et fichiers partagés, sans espace commun de suivi.",
  },
  {
    title: "Pas de traçabilité",
    text: "Aucun historique clair des versions ne permet de suivre les améliorations dans le temps.",
  },
]

const steps = [
  { label: "Dépôt du rapport", desc: "L'étudiant dépose une version (PDF/DOCX), archivée et horodatée." },
  { label: "Analyse IA automatique", desc: "Structure, cohérence et qualité rédactionnelle sont évaluées." },
  { label: "Consultation & annotation", desc: "L'encadreur consulte le rapport et l'analyse, puis commente." },
  { label: "Nouvelle version", desc: "Le cycle se répète jusqu'à la version finale du rapport." },
]

const audiences = [
  {
    icon: <IconStudent size={22} className="text-primary-600" />,
    title: "Étudiant",
    items: [
      "Dépôt et versionnage du rapport",
      "Analyses IA à chaque version",
      "Commentaires de l'encadreur centralisés",
      "Atelier IA de correction assistée",
    ],
  },
  {
    icon: <IconSupervisor size={22} className="text-primary-600" />,
    title: "Encadreur",
    items: [
      "Lecture intégrée du rapport (PDF)",
      "Annotation page par page",
      "Historique chronologique des versions",
      "Analyses IA en appui de ses remarques",
    ],
  },
  {
    icon: <IconReport size={22} className="text-primary-600" />,
    title: "Administrateur",
    items: [
      "Gestion des comptes utilisateurs",
      "Supervision des projets et rapports",
      "Statistiques d'utilisation",
      "Vue d'ensemble des scores de qualité",
    ],
  },
]

export function LandingPage({
  onNavigate,
}: {
  onNavigate: (page: "landing" | "login" | "signup") => void
}) {
  return (
    <div className="bg-neutral-50 min-h-screen">
      <PublicNavbar onNavigate={onNavigate} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-neutral-900 leading-tight">
            Centralisez, suivez et améliorez vos rapports de PFE grâce à l'IA
          </h1>
          <p className="mt-5 text-lg text-neutral-600 font-body leading-relaxed">
            Encadrini remplace les échanges par email et les relectures tardives par un espace unique :
            dépôt de versions, annotation collaborative et analyse automatique par intelligence
            artificielle générative.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => onNavigate("signup")}>Créer un compte</Button>
            <Button size="lg" variant="secondary">Voir la démo</Button>
          </div>
        </div>
        <Card className="!p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium font-body text-neutral-500">Rapport_PFE_v3.pdf</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-100 text-[#4c1d95] px-2.5 py-1 text-xs font-medium">
              <IconSparkles size={12} /> Analysé par IA
            </span>
          </div>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full border-4 border-primary-100 flex items-center justify-center text-primary-700 font-bold font-display text-lg">
              82
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800 font-body">Score de qualité</p>
              <p className="text-xs text-neutral-500 font-body">Structure, cohérence & style combinés</p>
            </div>
          </div>
          <div className="space-y-2">
            {["Introduction générale complète", "État de l'art bien structuré", "Conclusion à renforcer"].map((t, i) => (
              <div key={t} className="flex items-center gap-2 text-sm font-body text-neutral-600">
                <IconCheck size={14} className={i < 2 ? "text-success-600" : "text-warning-600"} />
                {t}
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Problème */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold font-display text-neutral-900 mb-8 text-center">
          Le suivi actuel montre ses limites
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {problems.map((p) => (
            <Card key={p.title}>
              <h3 className="font-semibold font-display text-neutral-800 mb-2">{p.title}</h3>
              <p className="text-sm text-neutral-600 font-body leading-relaxed">{p.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="fonctionnalites" className="bg-white border-y border-neutral-200 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold font-display text-neutral-900 mb-10 text-center">
            Comment ça marche
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.label} className="relative">
                <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold font-display text-sm mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold font-display text-neutral-800 mb-1.5">{s.label}</h3>
                <p className="text-sm text-neutral-600 font-body leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-4 left-[calc(100%-8px)] w-[calc(100%-1rem)] h-px bg-neutral-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fonctionnalités IA */}
      <section id="atelier-ia" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-bold font-display text-neutral-900 mb-4">
              Une analyse IA construite sur trois modèles complémentaires
            </h2>
            <p className="text-neutral-600 font-body leading-relaxed mb-5">
              Plutôt qu'un modèle unique, Encadrini combine une analyse linguistique, une analyse
              structurelle et une analyse de cohérence pour produire un score de qualité fiable, un
              résumé, un abstract, des mots-clés et des questions de jury anticipées.
            </p>
            <ul className="space-y-2 text-sm font-body text-neutral-700">
              {["Correction grammaticale et orthographique", "Détection des sections manquantes", "Score global de qualité", "Résumé, abstract et mots-clés générés automatiquement"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <IconCheck size={14} className="text-ai-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-center gap-3">
            {["Linguistique", "Structurel", "Cohérence & fond"].map((m) => (
              <Card key={m} className="!p-4 text-center w-32">
                <IconSparkles size={20} className="text-ai-600 mx-auto mb-2" />
                <p className="text-xs font-medium font-body text-neutral-600">{m}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="bg-white border-y border-neutral-200 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold font-display text-neutral-900 mb-10 text-center">
            Pour qui ?
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {audiences.map((a) => (
              <Card key={a.title}>
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
                  {a.icon}
                </div>
                <h3 className="font-semibold font-display text-neutral-800 mb-3">{a.title}</h3>
                <ul className="space-y-1.5">
                  {a.items.map((it) => (
                    <li key={it} className="text-sm text-neutral-600 font-body flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-400 flex-shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section id="a-propos" className="max-w-4xl mx-auto px-6 py-20 text-center">
        <IconUpload size={28} className="text-primary-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold font-display text-neutral-900 mb-3">
          Prêt à structurer le suivi de votre PFE ?
        </h2>
        <p className="text-neutral-600 font-body mb-6">
          Créez votre projet, invitez votre encadreur et déposez votre première version.
        </p>
        <Button size="lg" onClick={() => onNavigate("signup")}>Créer un compte gratuitement</Button>
      </section>

      <footer className="border-t border-neutral-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-neutral-400 font-body">
          <span>© 2026 Encadrini</span>
          <span>Premier incrément — Gestion du rapport de PFE</span>
        </div>
      </footer>
    </div>
  )
}
