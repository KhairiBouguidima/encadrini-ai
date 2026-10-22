import { useEffect, useState } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { Card, Input, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconSupervisor, IconCheck, IconBell, IconUser, IconTrash, IconStats, IconStudent, IconAward } from "../../components/ui/Icons"
import { api, saveSession, getAccessToken, type User, type Project, type InvitationItem } from "../../lib/api"
import { useToast } from "../../components/ui/Toast"
import { getNavItems } from "../../lib/navItems"



export function ProfilePage({
  user,
  onUpdateUser,
  onNavigate,
  onExit,
}: {
  user?: User | null
  onUpdateUser: (updatedUser: User) => void
  onNavigate: (key: string) => void
  onExit: () => void
}) {
  // Form states for profile update
  const [firstName, setFirstName] = useState(user?.first_name || "")
  const [lastName, setLastName] = useState(user?.last_name || "")
  const [faculty, setFaculty] = useState(user?.faculty || "")
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "")
  const [apiKey, setApiKey] = useState(user?.openai_api_key || "")

  const [profileNotice, setProfileNotice] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Form states for inviting & managing supervisors
  const [project, setProject] = useState<Project | null>(null)
  const [invitations, setInvitations] = useState<InvitationItem[]>([])
  const [encadrerEmail, setEncadrerEmail] = useState("")
  const [inviteNotice, setInviteNotice] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Profil Utilisateur"

  const loadProjectAndInvitations = async () => {
    if (user?.role === "STUDENT") {
      try {
        const [proj, invs] = await Promise.all([
          api.getMyProject().catch(() => null),
          api.getProjectInvitations().catch(() => []),
        ])
        if (proj) setProject(proj)
        setInvitations(invs)
      } catch (err) {
        console.error("Failed to load project/invitations:", err)
      }
    }
  }

  useEffect(() => {
    loadProjectAndInvitations()
  }, [user])

  const handleProfileSave = async () => {
    setIsUpdatingProfile(true)
    setProfileNotice("")

    try {
      if (user) {
        const updated = await api.updateMe({
          first_name: firstName,
          last_name: lastName,
          faculty,
          phone_number: phoneNumber,
          openai_api_key: apiKey,
        })
        const currentAccessToken = getAccessToken()
        if (currentAccessToken) {
          saveSession({
            access_token: currentAccessToken,
            refresh_token: localStorage.getItem("encadrini_refresh_token") || "",
            token_type: "bearer",
            user: updated,
          })
        }
        onUpdateUser(updated)
        setProfileNotice("Informations mises à jour avec succès !")
      } else {
        setProfileNotice("Mode démo : modifications enregistrées localement.")
      }
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : "Erreur lors de la mise à jour.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleInviteSupervisor = async () => {
    if (!encadrerEmail.trim()) return
    setIsInviting(true)
    setInviteNotice("")
    setInviteLink("")

    try {
      const email = encadrerEmail.trim().toLowerCase()
      const res = await api.inviteSupervisor(email)
      if (res.email_sent) {
        setInviteLink("")
        setInviteNotice(`Invitation envoyée par email à ${email} ! En attente d'acceptation par l'encadreur.`)
      } else {
        setInviteLink(res.invitation_link)
        setInviteNotice(`Invitation créée. Partagez ce lien avec ${email} :`)
      }
      setEncadrerEmail("")
      await loadProjectAndInvitations()
    } catch (err) {
      setInviteNotice(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'invitation.")
    } finally {
      setIsInviting(false)
    }
  }

  const { toast, confirm } = useToast()

  const handleRemoveSupervisor = (encadrerId: string, encadrerName: string) => {
    confirm({
      title: "Retirer cet encadreur ?",
      message: `Êtes-vous sûr de vouloir retirer ${encadrerName} de vos encadreurs de projet ?`,
      confirmText: "Retirer l'encadreur",
      cancelText: "Annuler",
      variant: "danger",
      onConfirm: async () => {
        setActionLoadingId(encadrerId)
        try {
          const updatedProj = await api.removeEncadrer(encadrerId)
          setProject(updatedProj)
          await loadProjectAndInvitations()
          toast.success(`${encadrerName} a été retiré de votre projet.`)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Impossible de retirer cet encadreur.")
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  const handleCancelInvitation = (invitationId: string) => {
    confirm({
      title: "Annuler l'invitation ?",
      message: "Voulez-vous vraiment annuler cette invitation en attente ?",
      confirmText: "Annuler l'invitation",
      cancelText: "Garder",
      variant: "danger",
      onConfirm: async () => {
        setActionLoadingId(invitationId)
        try {
          await api.cancelInvitation(invitationId)
          setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
          toast.info("L'invitation a été annulée.")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Impossible d'annuler cette invitation.")
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  const connectedSupervisors = project?.encadrers || []
  const pendingInvitations = invitations.filter((i) => i.status === "PENDING")

  const userRole =
    user?.role === "ENCADRER"
      ? "Encadreur"
      : user?.role === "ADMIN"
      ? "Administrateur plateforme"
      : "Étudiant"

  const navItems = getNavItems(user?.role)

  return (
    <AppShell
      navItems={navItems}
      activeKey="profile"
      onNavigate={onNavigate}
      onExit={onExit}
      userName={userName}
      userRole={userRole}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <Avatar name={userName} role={userRole} size="lg" />
          <div>
            <h1 className="text-2xl font-bold font-display text-neutral-900">{userName}</h1>
            <p className="text-sm text-neutral-500 font-body">{user?.email || "etudiant@encadrini.tn"}</p>
          </div>
        </div>

        <div className={user?.role === "STUDENT" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "max-w-2xl mx-auto"}>
          {/* Card 1: Edit Profile */}
          <Card className="space-y-4">
            <h2 className="text-lg font-bold font-display text-neutral-900 border-b border-neutral-100 pb-3">
              Modifier mes informations
            </h2>

            <Input
              label="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
            />
            <Input
              label="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
            />
            <Input
              label="Faculté / Établissement"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="Ex: FST, ENSI, ISG..."
            />
            <Input
              label="Numéro de téléphone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+216 99 000 000"
            />
            <Input
              label="Clé API IA Personnelle (Optionnelle)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... ou xai-..."
              hint="Pour utiliser votre propre compte OpenAI ou xAI"
            />

            {profileNotice && (
              <p className="text-sm px-3 py-2 rounded-lg bg-neutral-100 text-neutral-700 font-body">
                {profileNotice}
              </p>
            )}

            <Button
              onClick={handleProfileSave}
              disabled={isUpdatingProfile}
              className="w-full justify-center"
            >
              {isUpdatingProfile ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </Card>

          {/* Card 2: Manage Supervisors & Invitations (Only for students) */}
          {user?.role === "STUDENT" && (
            <Card className="space-y-5">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                  <IconSupervisor size={18} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display text-neutral-900">
                    Mes Encadreurs & Relations
                  </h2>
                  <p className="text-xs text-neutral-500 font-body">
                    Vous pouvez avoir plusieurs encadreurs universitaires ou d'entreprise.
                  </p>
                </div>
              </div>

              {/* Section 2A: Connected Supervisors */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-body flex items-center justify-between">
                  <span>Encadreurs en relation ({connectedSupervisors.length})</span>
                  {connectedSupervisors.length > 0 && (
                    <span className="text-[11px] text-emerald-600 font-normal">Supervision active</span>
                  )}
                </h3>

                {connectedSupervisors.length === 0 ? (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-500 text-center font-body">
                    Aucun encadreur n'est encore connecté à votre projet. Envoyez une invitation ci-dessous.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connectedSupervisors.map((enc) => (
                      <div
                        key={enc.id}
                        className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={enc.name} role="Encadreur" size="sm" />
                          <div className="truncate">
                            <p className="font-semibold text-emerald-950 truncate flex items-center gap-1.5">
                              {enc.name}
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                En relation
                              </span>
                            </p>
                            <p className="text-emerald-700 font-mono text-[11px] truncate">{enc.email}</p>
                            {enc.faculty && <p className="text-neutral-500 text-[10px] truncate">{enc.faculty}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSupervisor(enc.id, enc.name)}
                          disabled={actionLoadingId === enc.id}
                          className="text-neutral-400 hover:text-danger-600 p-1.5 rounded-lg hover:bg-white transition-colors"
                          title="Retirer cet encadreur"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2B: Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 font-body">
                    Invitations envoyées en attente ({pendingInvitations.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate">
                          <p className="font-semibold text-neutral-800 truncate">{inv.encadrer_email}</p>
                          <p className="text-amber-700 text-[11px]">
                            En attente de réponse de l'encadreur
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelInvitation(inv.id)}
                            disabled={actionLoadingId === inv.id}
                            className="!text-neutral-500 hover:!text-danger-600 !text-xs !py-1 !px-2"
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2C: Invite New Supervisor Form */}
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 font-body">
                  Inviter un nouvel encadreur
                </h3>
                <p className="text-xs text-neutral-600 font-body leading-relaxed">
                  Entrez l'email de l'encadreur. Dès qu'il acceptera l'invitation, vous entrerez directement en relation pour le suivi de votre projet.
                </p>

                <Input
                  label="Email de l'encadreur"
                  type="email"
                  value={encadrerEmail}
                  onChange={(e) => setEncadrerEmail(e.target.value)}
                  placeholder="professeur@universite.tn"
                />

                {inviteNotice && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-primary-50 text-primary-800 font-body border border-primary-100 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <IconCheck size={14} /> {inviteNotice}
                    </p>
                    {inviteLink && (
                      <div className="mt-1 pt-1 border-t border-primary-200">
                        <p className="text-[11px] text-primary-700 font-medium mb-1">Lien direct :</p>
                        <input
                          readOnly
                          value={inviteLink}
                          className="w-full text-[11px] p-1.5 rounded bg-white border border-primary-200 text-neutral-700 font-mono"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleInviteSupervisor}
                  disabled={!encadrerEmail.trim() || isInviting}
                  variant="secondary"
                  className="w-full justify-center text-sm"
                >
                  {isInviting ? "Envoi de l'invitation..." : "Envoyer l'invitation"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}
