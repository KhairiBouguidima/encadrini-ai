import { useState, useEffect, useMemo } from "react"
import { Card, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { StatusBadge, type BadgeVariant } from "../../components/ui/Badge"
import {
  IconPlus,
  IconCheck,
  IconSparkles,
  IconUser,
  IconReport,
  IconDownload,
  IconX,
  IconFileText,
  IconAward,
  IconClock,
  IconSearch,
} from "../../components/ui/Icons"
import {
  api,
  type Technician,
  type AssistanceRequest,
} from "../../lib/api"

export function AdminTechniciansSection() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [requests, setRequests] = useState<AssistanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requestFilter, setRequestFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Add Technician Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone_number: "",
    specialties: ["Mise en page Word", "Normes universitaires"],
    bio: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Assign Modal State
  const [selectedRequest, setSelectedRequest] = useState<AssistanceRequest | null>(null)
  const [assignTechId, setAssignTechId] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const [techs, reqs] = await Promise.all([
        api.listTechnicians(),
        api.listAllAssistanceRequestsAdmin(),
      ])
      setTechnicians(techs)
      setRequests(reqs)
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement des données techniciens.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError("")
    try {
      await api.createTechnician({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number,
        specialties: form.specialties,
        bio: form.bio,
      })
      setShowAddModal(false)
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone_number: "",
        specialties: ["Mise en page Word", "Normes universitaires"],
        bio: "",
      })
      await fetchData()
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'ajout du technicien.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedRequest || !assignTechId) return
    setAssignLoading(true)
    try {
      await api.assignTechnician(selectedRequest.id, assignTechId)
      setSelectedRequest(null)
      await fetchData()
    } catch (err: any) {
      alert(err?.message || "Erreur lors de l'assignation.")
    } finally {
      setAssignLoading(false)
    }
  }

  const toggleSpecialty = (item: string) => {
    if (form.specialties.includes(item)) {
      setForm({ ...form, specialties: form.specialties.filter((s) => s !== item) })
    } else {
      setForm({ ...form, specialties: [...form.specialties, item] })
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

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (requestFilter === "PENDING" && r.status !== "PENDING_ASSIGNMENT") return false
      if (requestFilter === "IN_PROGRESS" && r.status !== "IN_PROGRESS") return false
      if (requestFilter === "DELIVERED" && r.status !== "DELIVERED" && r.status !== "COMPLETED") return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = r.report_title?.toLowerCase().includes(q)
        const matchStudent = r.student_name?.toLowerCase().includes(q) || r.student_email?.toLowerCase().includes(q)
        const matchTech = r.assigned_technician_name?.toLowerCase().includes(q)
        if (!matchTitle && !matchStudent && !matchTech) return false
      }
      return true
    })
  }, [requests, requestFilter, searchQuery])

  const totalRevenue = requests.reduce((acc, r) => acc + (r.price_tnd || 0), 0)
  const completedCount = requests.filter((r) => r.status === "COMPLETED" || r.status === "DELIVERED").length
  const pendingAssignmentCount = requests.filter((r) => r.status === "PENDING_ASSIGNMENT").length
  const inProgressCount = requests.filter((r) => r.status === "IN_PROGRESS").length

  return (
    <div className="space-y-7 animate-in fade-in duration-150">
      
      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-neutral-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Techniciens Agréés
            </span>
            <div className="text-3xl font-extrabold text-neutral-900 mt-1">{technicians.length}</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Certifiés par l'administration</span>
            <span className="text-emerald-600 font-bold">100% Vérifiés</span>
          </div>
        </Card>

        <Card className="p-5 border-neutral-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Demandes Totales
            </span>
            <div className="text-3xl font-extrabold text-neutral-900 mt-1">{requests.length}</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>En attente : <strong className="text-amber-600">{pendingAssignmentCount}</strong></span>
            <span>En cours : <strong className="text-blue-600">{inProgressCount}</strong></span>
          </div>
        </Card>

        <Card className="p-5 border-neutral-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Rapports Livrés
            </span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{completedCount}</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Formatés & Validés</span>
            <span className="text-emerald-700 font-bold">
              {requests.length > 0 ? `${Math.round((completedCount / requests.length) * 100)}% succès` : "100%"}
            </span>
          </div>
        </Card>

        <Card className="p-5 border-neutral-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Volume Chiffre d'Affaires
            </span>
            <div className="text-3xl font-extrabold text-indigo-950 mt-1">{totalRevenue} DT</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Dinars Tunisiens (TND)</span>
            <span className="text-primary-700 font-semibold">Konnect / Flouci</span>
          </div>
        </Card>
      </div>

      {/* ── SECTION: TECHNICIENS ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-display text-neutral-900 flex items-center gap-2">
              <span>🛠️</span> Équipe de Techniciens & Formateurs Agréés
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
              Experts universitaires vérifiés pour la conformité typographique, LaTeX et les normes PFE.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowAddModal(true)}
            className="cursor-pointer shadow-sm bg-neutral-900 hover:bg-black text-white font-semibold"
          >
            <IconPlus size={16} />
            Ajouter un Technicien de Confiance
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Technicians Cards Grid */}
        {technicians.length === 0 && !loading ? (
          <Card className="p-10 text-center text-neutral-400">
            <IconUser size={36} className="mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">Aucun technicien enregistré pour le moment.</p>
            <p className="text-xs mt-1">Cliquez sur le bouton ci-dessus pour ajouter votre premier technicien de confiance.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {technicians.map((t) => (
              <Card key={t.id} className="p-5 border-neutral-200 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${t.first_name} ${t.last_name}`} size="md" />
                      <div>
                        <h4 className="font-bold text-neutral-900 text-sm">{t.first_name} {t.last_name}</h4>
                        <div className="text-xs text-neutral-500">{t.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Certifié Thiga
                    </span>
                  </div>

                  <div className="text-xs text-neutral-600 mb-3 space-y-1">
                    <div><strong>Tél :</strong> {t.phone_number || "Non renseigné"}</div>
                    {t.phone_number && (
                      <a
                        href={`https://wa.me/${t.phone_number.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold hover:underline"
                      >
                        <span>💬 Contacter sur WhatsApp</span>
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {t.specialties.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span>Rapports traités : <strong className="text-neutral-900">{t.completed_assistance_count}</strong></span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Actif
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION: COMMANDES & DEMANDES D'ASSISTANCE ── */}
      <div className="space-y-4 pt-4">
        <Card padded={false} className="border-neutral-200">
          
          {/* Header with Search & Filter Tabs */}
          <div className="p-5 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold font-display text-neutral-900">
                Commandes & Suivi des Mises en Page
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Supervisez l'attribution des rapports, la conformité des livrables et la satisfaction des étudiants.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="flex items-center gap-2 border border-neutral-200 rounded-xl px-3 py-1.5 bg-white text-xs w-56 shadow-2xs">
                <IconSearch size={14} className="text-neutral-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer demandes..."
                  className="w-full focus:outline-none bg-transparent"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-semibold">
                {[
                  { key: "ALL", label: `Toutes (${requests.length})` },
                  { key: "PENDING", label: `À assigner (${pendingAssignmentCount})` },
                  { key: "IN_PROGRESS", label: `En cours (${inProgressCount})` },
                  { key: "DELIVERED", label: `Livrées (${completedCount})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRequestFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      requestFilter === f.key
                        ? "bg-white text-neutral-900 shadow-2xs font-bold"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Requests Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-body">
              <thead>
                <tr className="text-xs uppercase font-semibold text-neutral-500 bg-neutral-50 border-b border-neutral-200">
                  <th className="py-3 px-5">Étudiant</th>
                  <th className="py-3 px-5">Mémoire & Service</th>
                  <th className="py-3 px-5">Tarif Standard</th>
                  <th className="py-3 px-5">Statut Workflow</th>
                  <th className="py-3 px-5">Technicien Assigné</th>
                  <th className="py-3 px-5 text-right">Fichiers & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      Aucune demande ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/80 transition-colors">
                      
                      {/* Student */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-neutral-900">{r.student_name}</div>
                        <div className="text-xs text-neutral-500">{r.student_email}</div>
                        {r.student_phone && (
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">Tél : {r.student_phone}</div>
                        )}
                      </td>

                      {/* Report & Service */}
                      <td className="py-3.5 px-5 max-w-xs">
                        <div className="font-semibold text-neutral-900 truncate">{r.report_title}</div>
                        <div className="text-xs text-primary-700 font-semibold">{r.service_label}</div>
                        {r.notes_from_student && (
                          <div className="text-[11px] text-neutral-500 italic mt-0.5 line-clamp-1">
                            "{r.notes_from_student}"
                          </div>
                        )}
                        {r.deadline_date && (
                          <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                            Échéance : {r.deadline_date}
                          </div>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-5">
                        <span className="font-extrabold text-neutral-900 text-sm">{r.price_tnd} DT</span>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Payé ({r.payment_provider || "TND"})
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <StatusBadge variant={getStatusBadge(r.status)} size="sm">
                          {r.status === "PENDING_ASSIGNMENT" && "À assigner"}
                          {r.status === "IN_PROGRESS" && "En cours de travail"}
                          {r.status === "DELIVERED" && "Livrable envoyé"}
                          {r.status === "COMPLETED" && "Validé par l'étudiant"}
                        </StatusBadge>
                        {r.rating && (
                          <div className="text-[11px] text-amber-500 mt-1 font-bold">
                            {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} ({r.rating}/5)
                          </div>
                        )}
                      </td>

                      {/* Assigned Tech */}
                      <td className="py-3.5 px-5">
                        {r.assigned_technician_name ? (
                          <div>
                            <div className="font-semibold text-neutral-800">{r.assigned_technician_name}</div>
                            <div className="text-xs text-neutral-400">{r.assigned_technician_phone}</div>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Non assigné
                          </span>
                        )}
                      </td>

                      {/* Files & Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.student_file_url && (
                            <a
                              href={api.getAssistanceDownloadUrl(r.id, "student")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
                              title="Télécharger le document original de l'étudiant"
                            >
                              Original
                            </a>
                          )}
                          {r.delivered_file_url && (
                            <a
                              href={api.getAssistanceDownloadUrl(r.id, "delivered")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                              title="Télécharger le rapport formaté final"
                            >
                              Formaté ✨
                            </a>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(r)
                              setAssignTechId(r.assigned_technician_id || (technicians[0]?.id || ""))
                            }}
                            className="cursor-pointer text-xs"
                          >
                            {r.assigned_technician_name ? "Changer" : "Assigner"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── MODAL: AJOUTER UN TECHNICIEN ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-neutral-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-neutral-900 to-indigo-950 text-white relative">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 text-neutral-300 hover:text-white cursor-pointer"
              >
                <IconX size={20} />
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-primary-200 text-xs font-semibold mb-2">
                <IconSparkles size={12} /> Confiance & Expertise
              </div>
              <h3 className="text-xl font-bold font-display">Ajouter un Technicien de Confiance</h3>
              <p className="text-xs text-neutral-300 mt-1">
                Ce compte aura accès à l'espace technicien pour télécharger les mémoires et livrer les versions formatées.
              </p>
            </div>

            <form onSubmit={handleCreateTechnician} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                    placeholder="Ahmed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                    placeholder="Ben Salah"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Email Professionnel *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                  placeholder="technicien@encadrini.tn"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Mot de passe temporaire *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Téléphone (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                    placeholder="+216 98 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Spécialités de mise en page :
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Mise en page Word",
                    "Template LaTeX",
                    "Normes universitaires",
                    "Correction linguistique",
                    "Mise en forme des Figures & Tables",
                  ].map((s) => {
                    const active = form.specialties.includes(s)
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => toggleSpecialty(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                            : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        {active && "✓ "}
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowAddModal(false)}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? "Création..." : "Enregistrer le Technicien"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ASSIGNER UN TECHNICIEN ── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-neutral-200 p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-neutral-900">
              Assigner un technicien à la demande
            </h3>
            <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <div><strong>Étudiant :</strong> {selectedRequest.student_name}</div>
              <div><strong>Mémoire :</strong> {selectedRequest.report_title}</div>
              <div><strong>Service :</strong> {selectedRequest.service_label}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Choisir le technicien responsable :
              </label>
              <select
                value={assignTechId}
                onChange={(e) => setAssignTechId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white font-medium cursor-pointer"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} ({t.specialties.join(", ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
              <Button variant="secondary" size="sm" onClick={() => setSelectedRequest(null)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" disabled={assignLoading} onClick={handleAssign}>
                {assignLoading ? "Assignation..." : "Confirmer l'Assignation"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
