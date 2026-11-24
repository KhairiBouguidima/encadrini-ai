import { useState, useEffect } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import {
  IconReport,
  IconCheck,
  IconDownload,
  IconSparkles,
  IconUser,
  IconFileText,
} from "../../components/ui/Icons"
import {
  api,
  type AssistanceRequest,
  type User,
} from "../../lib/api"

export function TechnicianDashboard({
  user,
  onExit,
}: {
  user?: User | null
  onExit: () => void
}) {
  const [tasks, setTasks] = useState<AssistanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Deliver Modal / Form State
  const [deliveringTask, setDeliveringTask] = useState<AssistanceRequest | null>(null)
  const [deliverFile, setDeliverFile] = useState<File | null>(null)
  const [deliverNotes, setDeliverNotes] = useState("")
  const [delivering, setDelivering] = useState(false)
  const [deliverError, setDeliverError] = useState("")

  const navItems: NavItem[] = [
    { key: "tasks", label: "Missions de Mise en page", icon: <IconReport size={18} /> },
  ]

  const fetchTasks = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.listTechnicianTasks()
      setTasks(data)
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement des missions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deliveringTask || !deliverFile) return

    setDelivering(true)
    setDeliverError("")
    try {
      const formData = new FormData()
      formData.append("file", deliverFile)
      formData.append("technician_notes", deliverNotes)

      await api.deliverTechnicianTask(deliveringTask.id, formData)
      setDeliveringTask(null)
      setDeliverFile(null)
      setDeliverNotes("")
      await fetchTasks()
    } catch (err: any) {
      setDeliverError(err?.message || "Erreur lors de la livraison du rapport.")
    } finally {
      setDelivering(false)
    }
  }

  const getStatusBadge = (status: string): BadgeVariant => {
    switch (status) {
      case "COMPLETED":
        return "accepted"
      case "DELIVERED":
        return "analysed"
      case "IN_PROGRESS":
        return "reviewing"
      default:
        return "pending"
    }
  }

  const activeCount = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PENDING_ASSIGNMENT").length
  const deliveredCount = tasks.filter((t) => t.status === "DELIVERED" || t.status === "COMPLETED").length

  return (
    <AppShell
      navItems={navItems}
      activeKey="tasks"
      onNavigate={() => {}}
      onExit={onExit}
      userName={user ? `${user.first_name} ${user.last_name}` : "Technicien Certifié"}
      userRole="Technicien de Confiance • Mise en page"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-bold mb-2">
              <IconSparkles size={14} className="text-primary-600" />
              Espace Technicien Agréé
            </div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">
              Missions de Mise en page & Assistance PFE
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Téléchargez les mémoires des étudiants, appliquez les normes académiques et livrez les versions finales.
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchTasks}>
            Actualiser
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border-neutral-200">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Missions Totales
            </div>
            <div className="text-3xl font-extrabold text-neutral-900">{tasks.length}</div>
            <div className="text-xs text-neutral-400 mt-2">Assignées par l'administration</div>
          </Card>

          <Card className="p-5 border-neutral-200">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              En cours de traitement
            </div>
            <div className="text-3xl font-extrabold text-amber-600">{activeCount}</div>
            <div className="text-xs text-neutral-400 mt-2">À finaliser avant la deadline</div>
          </Card>

          <Card className="p-5 border-neutral-200">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Rapports Livrés
            </div>
            <div className="text-3xl font-extrabold text-emerald-600">{deliveredCount}</div>
            <div className="text-xs text-neutral-400 mt-2">Mise en page achevée</div>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-display text-neutral-900">
            Vos Missions en cours
          </h2>

          {tasks.length === 0 && !loading ? (
            <Card className="p-10 text-center text-neutral-500">
              <IconFileText size={40} className="mx-auto mb-3 text-neutral-400" />
              <p className="font-semibold text-neutral-700">Aucune mission assignée pour l'instant.</p>
              <p className="text-xs mt-1">Dès qu'un étudiant commande une mise en page, elle apparaîtra ici.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const isDelivered = task.status === "DELIVERED" || task.status === "COMPLETED"
                return (
                  <Card key={task.id} className="p-6 border-neutral-200 hover:shadow-sm transition-all">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Left: Task Info */}
                      <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-neutral-900">
                            {task.report_title}
                          </span>
                          <StatusBadge variant={getStatusBadge(task.status)} size="sm">
                            {task.status === "PENDING_ASSIGNMENT" && "En attente"}
                            {task.status === "IN_PROGRESS" && "En cours de travail"}
                            {task.status === "DELIVERED" && "Rapport livré"}
                            {task.status === "COMPLETED" && "Validé & Noté"}
                          </StatusBadge>
                        </div>

                        <div className="text-xs text-primary-700 font-semibold flex items-center gap-2">
                          <span>🛠️ {task.service_label}</span>
                          <span className="text-neutral-300">•</span>
                          <span className="text-neutral-900 font-bold">{task.price_tnd} DT</span>
                        </div>

                        {/* Student Details */}
                        <div className="p-3 bg-neutral-50 rounded-xl text-xs space-y-1 text-neutral-700 border border-neutral-100">
                          <div><strong>Étudiant :</strong> {task.student_name} ({task.student_email})</div>
                          {task.student_phone && (
                            <div><strong>Téléphone :</strong> <a href={`tel:${task.student_phone}`} className="text-primary-600 underline">{task.student_phone}</a></div>
                          )}
                          {task.deadline_date && (
                            <div><strong>Date limite souhaitée :</strong> <span className="text-danger-600 font-semibold">{task.deadline_date}</span></div>
                          )}
                          {task.notes_from_student && (
                            <div className="pt-1 text-neutral-600 italic">
                              <strong>Consignes de la faculté :</strong> "{task.notes_from_student}"
                            </div>
                          )}
                        </div>

                        {/* Delivery notes if already delivered */}
                        {task.delivered_file_name && (
                          <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                            <strong>Fichier livré :</strong> {task.delivered_file_name}
                            {task.technician_notes && <div className="mt-0.5"><em>Notes : {task.technician_notes}</em></div>}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                        {task.student_file_url && (
                          <a
                            href={api.getAssistanceDownloadUrl(task.id, "student")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
                          >
                            <IconDownload size={14} />
                            Télécharger l'Original
                          </a>
                        )}

                        {!isDelivered ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setDeliveringTask(task)
                              setDeliverFile(null)
                              setDeliverNotes("")
                            }}
                            className="bg-primary-600 hover:bg-primary-700 text-white cursor-pointer font-semibold shadow-xs"
                          >
                            <IconCheck size={14} />
                            Livrer le Rapport Formaté
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setDeliveringTask(task)
                              setDeliverFile(null)
                              setDeliverNotes(task.technician_notes || "")
                            }}
                          >
                            Mettre à jour la livraison
                          </Button>
                        )}
                      </div>

                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Deliver Modal */}
      {deliveringTask && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-neutral-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold font-display text-neutral-900">
              Livraison du Rapport Formaté
            </h3>
            <p className="text-xs text-neutral-500">
              Téléversez la version finale formatée (Word, LaTeX .zip, ou PDF). L'étudiant sera notifié pour la télécharger.
            </p>

            {deliverError && (
              <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-lg">
                {deliverError}
              </div>
            )}

            <form onSubmit={handleDeliver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Sélectionner le fichier formaté (.docx, .pdf, .zip) * :
                </label>
                <input
                  type="file"
                  required
                  accept=".docx,.pdf,.zip,.tar.gz"
                  onChange={(e) => setDeliverFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Notes et explications pour l'étudiant :
                </label>
                <textarea
                  rows={3}
                  value={deliverNotes}
                  onChange={(e) => setDeliverNotes(e.target.value)}
                  placeholder="Ex: J'ai corrigé les styles de titre, généré la table des matières automatique et ajusté la pagination en chiffres romains."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <Button variant="secondary" size="sm" type="button" onClick={() => setDeliveringTask(null)}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={delivering || !deliverFile}>
                  {delivering ? "Envoi en cours..." : "Confirmer la Livraison"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
