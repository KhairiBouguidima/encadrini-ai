import { useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge } from "../../components/ui/Badge"
import { IconReport, IconStudent, IconBell, IconSparkles } from "../../components/ui/Icons"

const navItems: NavItem[] = [
  { key: "students", label: "Mes étudiants", icon: <IconStudent size={18} /> },
  { key: "reports", label: "Rapports", icon: <IconReport size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
]

const pages = Array.from({ length: 32 }, (_, i) => i + 1)
const annotatedPages = new Set([4, 12, 24])

interface Annotation {
  id: string
  author: string
  date: string
  text: string
}

const existingAnnotations: Annotation[] = [
  { id: "a1", author: "Pr. Saïd Amrani", date: "19 juil. 2026", text: "La méthodologie gagnerait à préciser le protocole d'évaluation croisée." },
]

export function ReportReviewer({ onExit }: { onExit: () => void }) {
  const [currentPage, setCurrentPage] = useState(12)
  const [annotations, setAnnotations] = useState<Annotation[]>(existingAnnotations)
  const [draft, setDraft] = useState("")

  const submitAnnotation = () => {
    if (!draft.trim()) return
    setAnnotations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: "Pr. Saïd Amrani", date: "aujourd'hui", text: draft.trim() },
    ])
    setDraft("")
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey="reports"
      onNavigate={() => {}}
      onExit={onExit}
      userName="Pr. Saïd Amrani"
      userRole="Encadreur · Génie informatique"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-display text-neutral-900">
              Détection d'anomalies réseau par apprentissage automatique
            </h1>
            <p className="text-sm text-neutral-500 font-body mt-1 flex items-center gap-2">
              Karim Boumediene · <StatusBadge variant="analysed" />
            </p>
          </div>
          <select className="text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 text-neutral-700">
            <option>Version 3 — 18 juil. 2026</option>
            <option>Version 2 — 02 juil. 2026</option>
            <option>Version 1 — 20 juin 2026</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* Visionneuse PDF */}
          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </button>
                <span className="text-sm font-body text-neutral-600">
                  Page {currentPage} / {pages.length}
                </span>
                <button
                  className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  onClick={() => setCurrentPage((p) => Math.min(pages.length, p + 1))}
                  disabled={currentPage === pages.length}
                >
                  →
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm font-body text-neutral-500">
                <button className="hover:text-neutral-800">−</button>
                <span>100%</span>
                <button className="hover:text-neutral-800">+</button>
              </div>
            </div>

            <div className="bg-neutral-100 py-8 flex justify-center">
              <div className="bg-white shadow-sm w-[440px] aspect-[210/297] rounded-sm p-8 text-xs text-neutral-300 font-body leading-relaxed">
                <p className="text-neutral-500 font-semibold mb-2">Chapitre 3 — Méthodologie</p>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="h-2 bg-neutral-100 rounded mb-2" style={{ width: `${90 - (i % 4) * 10}%` }} />
                ))}
              </div>
            </div>

            <div className="flex gap-1 px-4 py-3 border-t border-neutral-200 overflow-x-auto">
              {pages.map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`relative flex-shrink-0 w-7 h-9 rounded border text-[10px] font-body flex items-center justify-center transition-colors ${
                    p === currentPage
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                  }`}
                >
                  {p}
                  {annotatedPages.has(p) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-ai-600" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Panneau d'annotations */}
          <Card padded={false} className="flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-200">
              <h2 className="font-semibold font-display text-neutral-800 text-sm">
                Annotations — page {currentPage}
              </h2>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-[240px]">
              {annotations.length === 0 && (
                <p className="text-sm text-neutral-400 font-body">Aucune annotation sur cette page.</p>
              )}
              {annotations.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <Avatar name={a.author} size="sm" />
                  <div>
                    <p className="text-xs text-neutral-400 font-body">{a.date}</p>
                    <p className="text-sm text-neutral-700 font-body leading-relaxed">{a.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-200">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ajouter une annotation sur cette page..."
                rows={3}
                className="w-full text-sm font-body border border-neutral-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
              <Button fullWidth size="sm" className="mt-2" onClick={submitAnnotation}>
                Ajouter le commentaire
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="ai" size="sm" icon={<IconSparkles size={14} />}>
            Voir l'analyse IA de cette version
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
