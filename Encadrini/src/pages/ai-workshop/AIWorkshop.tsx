import { useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconBell, IconSend } from "../../components/ui/Icons"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

interface ChatMessage {
  role: "student" | "ai"
  text: string
}

const initialMessages: ChatMessage[] = [
  { role: "student", text: "Pourquoi mon chapitre 3 est-il signalé comme incomplet ?" },
  {
    role: "ai",
    text: "Le chapitre 3 ne contient pas de section « Protocole d'évaluation » ni de description des métriques utilisées, pourtant attendues dans un chapitre méthodologique. Voulez-vous une proposition de plan complété ?",
  },
]

interface Suggestion {
  id: string
  model: "Linguistique" | "Structurel" | "Cohérence & fond"
  excerpt: string
  suggestion: string
}

const suggestions: Suggestion[] = [
  {
    id: "s1",
    model: "Linguistique",
    excerpt: "« Le modèle à était entraîné sur... »",
    suggestion: "Le modèle a été entraîné sur...",
  },
  {
    id: "s2",
    model: "Structurel",
    excerpt: "Chapitre 3 — Méthodologie",
    suggestion: "Ajouter une sous-section « Protocole d'évaluation croisée » avant la présentation des résultats.",
  },
  {
    id: "s3",
    model: "Cohérence & fond",
    excerpt: "Chapitres 2 et 4",
    suggestion: "Les hypothèses posées en état de l'art ne sont pas reprises dans la discussion des résultats.",
  },
]

const modelColors: Record<Suggestion["model"], string> = {
  "Linguistique": "bg-info-100 text-[#1e3a5f]",
  "Structurel": "bg-warning-100 text-[#92400e]",
  "Cohérence & fond": "bg-ai-100 text-[#4c1d95]",
}

export function AIWorkshop({ onExit }: { onExit: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [reviewRunning, setReviewRunning] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages((prev) => [
      ...prev,
      { role: "student", text: input.trim() },
      { role: "ai", text: "Voici une reformulation possible du passage concerné, en tenant compte du contexte de votre rapport." },
    ])
    setInput("")
  }

  const launchReview = () => {
    setReviewRunning(true)
    setReviewDone(false)
    setTimeout(() => {
      setReviewRunning(false)
      setReviewDone(true)
    }, 1400)
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey="workshop"
      onNavigate={() => {}}
      onExit={onExit}
      userName="Karim Boumediene"
      userRole="Étudiant · M2 informatique"
    >
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold font-display text-neutral-900 mb-1">Atelier IA</h1>
        <p className="text-sm text-neutral-500 font-body mb-6">
          Version 3 — Détection d'anomalies réseau par apprentissage automatique
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
          {/* Aperçu du rapport avec passages surlignés */}
          <Card padded={false}>
            <div className="px-4 py-3 border-b border-neutral-200">
              <h2 className="font-semibold font-display text-neutral-800 text-sm">Aperçu du rapport</h2>
            </div>
            <div className="p-6 bg-neutral-50 text-sm font-body text-neutral-600 leading-relaxed space-y-3">
              <p>
                <span className="bg-ai-100 rounded px-1">Le modèle à était entraîné sur</span> un jeu de
                données réel comportant plus de deux millions de flux réseau étiquetés.
              </p>
              <p>
                Chapitre 3 — Méthodologie. Cette section présente l'architecture retenue ainsi que les
                choix d'hyperparamètres.{" "}
                <span className="bg-warning-100 rounded px-1">
                  [section « Protocole d'évaluation croisée » manquante]
                </span>
              </p>
              <p>
                Les hypothèses formulées dans l'état de l'art trouvent un écho partiel dans la discussion
                des résultats,{" "}
                <span className="bg-ai-100 rounded px-1">
                  sans que le lien ne soit explicitement établi entre les deux chapitres
                </span>
                .
              </p>
            </div>

            <div className="p-4 border-t border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(["Linguistique", "Structurel", "Cohérence & fond"] as const).map((m) => (
                  <span key={m} className={`text-xs font-medium font-body rounded-full px-2.5 py-1 ${modelColors[m]}`}>
                    {m}
                  </span>
                ))}
              </div>
              <Button
                variant="ai"
                size="sm"
                icon={<IconSparkles size={14} />}
                onClick={launchReview}
                disabled={reviewRunning}
              >
                {reviewRunning ? "Analyse en cours…" : "Lancer une revue complète"}
              </Button>
            </div>

            {reviewDone && (
              <div className="p-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold font-display text-neutral-800 mb-3">
                  Suggestions de correction
                </h3>
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div key={s.id} className="border border-neutral-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-medium font-body rounded-full px-2 py-0.5 ${modelColors[s.model]}`}>
                          {s.model}
                        </span>
                        <button className="text-xs font-medium font-body text-primary-600 hover:underline">
                          Voir le détail
                        </button>
                      </div>
                      <p className="text-xs text-neutral-400 font-body mb-1">Passage concerné : {s.excerpt}</p>
                      <p className="text-sm text-neutral-700 font-body">{s.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Chat conversationnel */}
          <Card padded={false} className="flex flex-col h-[560px]">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
              <IconSparkles size={16} className="text-ai-600" />
              <h2 className="font-semibold font-display text-neutral-800 text-sm">Chat avec l'IA</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm font-body leading-relaxed ${
                    m.role === "student"
                      ? "ml-auto bg-primary-600 text-white"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-neutral-200 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Posez une question sur votre rapport…"
                className="flex-1 text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
              <button
                onClick={sendMessage}
                className="w-9 h-9 flex-shrink-0 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors"
              >
                <IconSend size={15} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
