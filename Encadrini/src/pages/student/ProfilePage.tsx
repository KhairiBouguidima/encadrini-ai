import { useEffect, useState } from "react"
import { AppShell, type NavItem } from "../../components/layout/AppShell"
import { Card, Input, Avatar } from "../../components/ui/Primitives"
import { Button } from "../../components/ui/Button"
import { IconReport, IconSparkles, IconSupervisor, IconCheck, IconBell, IconUser } from "../../components/ui/Icons"
import { api, saveSession, getAccessToken, type User, type Project } from "../../lib/api"

const navItems: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord", icon: <IconReport size={18} /> },
  { key: "workshop", label: "Atelier IA", icon: <IconSparkles size={18} /> },
  { key: "notifications", label: "Notifications", icon: <IconBell size={18} /> },
  { key: "profile", label: "Mon Profil & Encadreur", icon: <IconUser size={18} /> },
]

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

  // Form states for inviting supervisor
  const [project, setProject] = useState<Project | null>(null)
  const [encadrerEmail, setEncadrerEmail] = useState("")
  const [inviteNotice, setInviteNotice] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [isInviting, setIsInviting] = useState(false)

  const userName = user ? `${user.first_name} ${user.last_name}` : "Profil Utilisateur"
  const userRole = user?.role === "ENCADRER" ? "Encadreur" : user?.role === "ADMIN" ? "Administrateur" : "Étudiant"

  useEffect(() => {
    if (user?.role === "STUDENT") {
      api.getMyProject().then(setProject).catch(() => null)
    }
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
      const email = encadrerEmail.trim()
      const res = await api.inviteSupervisor(email)
      if (res.email_sent) {
        setInviteLink("")
        setInviteNotice(`Invitation envoyée par email à ${email} !`)
      } else {
        setInviteLink(res.invitation_link)
        setInviteNotice(`L'email n'a pas pu être envoyé. Partagez ce lien avec ${email} :`)
      }
      setEncadrerEmail("")
      const freshProject = await api.getMyProject().catch(() => null)
      if (freshProject) setProject(freshProject)
    } catch (err) {
      setInviteNotice(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'invitation.")
    } finally {
      setIsInviting(false)
    }
  }

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          {/* Card 2: Invite Supervisor */}
          <Card className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                  <IconSupervisor size={18} className="text-primary-600" />
                </div>
                <h2 className="text-lg font-bold font-display text-neutral-900">
                  Inviter mon encadreur
                </h2>
              </div>

              <p className="text-sm text-neutral-600 font-body leading-relaxed">
                Entrez l'adresse email de votre encadreur universitaire ou d'entreprise. Il recevra un lien sécurisé pour rejoindre la plateforme et suivre l'avancement de votre rapport PFE.
              </p>

              {project?.encadrer_id && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <IconCheck size={16} className="text-emerald-600" />
                    Encadreur actuel : {project.encadrer_name || "Supervision active"}
                  </p>
                  {project.encadrer_email && (
                    <p className="text-emerald-700 font-mono text-[11px] pl-5.5">{project.encadrer_email}</p>
                  )}
                </div>
              )}

              <Input
                label="Email de l'encadreur"
                type="email"
                value={encadrerEmail}
                onChange={(e) => setEncadrerEmail(e.target.value)}
                placeholder="encadreur@universite.tn"
              />

              {inviteNotice && (
                <div className="text-sm px-3 py-2 rounded-lg bg-primary-50 text-primary-800 font-body border border-primary-100">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <IconCheck size={16} /> {inviteNotice}
                  </p>
                  {inviteLink && (
                    <div className="mt-2 pt-2 border-t border-primary-200">
                      <p className="text-xs text-primary-600 font-medium mb-1">Lien d'invitation généré :</p>
                      <input
                        readOnly
                        value={inviteLink}
                        className="w-full text-xs p-2 rounded bg-white border border-primary-200 text-neutral-700 font-mono"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleInviteSupervisor}
              disabled={!encadrerEmail.trim() || isInviting}
              variant="secondary"
              className="w-full justify-center"
            >
              {isInviting ? "Envoi en cours..." : "Envoyer l'invitation"}
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
