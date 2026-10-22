import { useState, useRef } from "react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Primitives"
import { 
  IconSparkles, IconUpload, IconX, IconLock, 
  IconAlertTriangle, IconFileText, IconShield 
} from "../../components/ui/Icons"
import { api, type SimulationDetail, type SubscriptionUsage } from "../../lib/api"

const SUGGESTED_TECHS = [
  "React", "TypeScript", "FastAPI", "Python", "Spring Boot", 
  "Java", "PostgreSQL", "MongoDB", "Docker", "Node.js", 
  "Next.js", "PyTorch", "Kubernetes", "Tailwind CSS", "Redis"
]

export function CreateDefenseModal({
  usage,
  onClose,
  onCreated,
  onOpenUpgrade,
}: {
  usage: SubscriptionUsage | null
  onClose: () => void
  onCreated: (simulation: SimulationDetail) => void
  onOpenUpgrade: () => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [academicLevel, setAcademicLevel] = useState("Master")
  const [category, setCategory] = useState("Génie Logiciel")
  const [techStack, setTechStack] = useState<string[]>(["React", "FastAPI", "PostgreSQL"])
  const [customTech, setCustomTech] = useState("")
  const [language, setLanguage] = useState<"fr" | "en" | "ar">("fr")
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "expert">("intermediate")
  const [mode, setMode] = useState<"TRAINING" | "REALISTIC" | "STRESS_TEST">("TRAINING")
  const [durationMinutes, setDurationMinutes] = useState(20)

  const [reportFile, setReportFile] = useState<File | null>(null)
  const [slidesFile, setSlidesFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState("")
  const [error, setError] = useState("")

  const reportInputRef = useRef<HTMLInputElement>(null)
  const slidesInputRef = useRef<HTMLInputElement>(null)

  const toggleTech = (tech: string) => {
    if (techStack.includes(tech)) {
      setTechStack(techStack.filter((t) => t !== tech))
    } else {
      setTechStack([...techStack, tech])
    }
  }

  const addCustomTech = () => {
    const trimmed = customTech.trim()
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack([...techStack, trimmed])
      setCustomTech("")
    }
  }

  const handleReportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 40 * 1024 * 1024) {
        setError("Le fichier du rapport dépasse 40 Mo.")
        return
      }
      setReportFile(f)
      if (!title) {
        const cleanName = f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")
        setTitle(cleanName)
      }
    }
  }

  const handleSlidesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 40 * 1024 * 1024) {
        setError("Le fichier des slides dépasse 40 Mo.")
        return
      }
      setSlidesFile(f)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Veuillez renseigner le titre du projet.")
      return
    }

    if (mode === "STRESS_TEST" && usage?.plan === "FREE") {
      onOpenUpgrade()
      return
    }

    setLoading(true)
    setError("")
    setLoadingStep("Téléversement et sécurisation des documents...")

    try {
      const fd = new FormData()
      fd.append("title", title.trim())
      fd.append("description", description.trim())
      fd.append("academic_level", academicLevel)
      fd.append("category", category)
      fd.append("tech_stack", JSON.stringify(techStack))
      fd.append("language", language)
      fd.append("difficulty", difficulty)
      fd.append("mode", mode)
      fd.append("duration_minutes", durationMinutes.toString())

      if (reportFile) {
        fd.append("report_file", reportFile)
      }
      if (slidesFile) {
        fd.append("slides_file", slidesFile)
      }

      setLoadingStep("Extraction du profil de connaissances et structuration RAG...")
      const sim = await api.createMockDefense(fd)

      setLoadingStep("Génération des questions personnalisées par le jury IA...")
      onCreated(sim)
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la création de la simulation.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-neutral-200 overflow-hidden my-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-indigo-950 p-6 text-white relative">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-5 right-5 text-neutral-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <IconX size={20} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold mb-2">
            <IconSparkles size={14} /> Simulateur de Soutenance IA
          </div>
          <h2 className="text-2xl font-bold font-display">Configurer une Soutenance Blanche</h2>
          <p className="text-primary-100 text-sm mt-1">
            Déposez votre rapport ou mémoire de PFE pour générer un jury virtuel sur-mesure.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-5">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-neutral-900 font-display">Analyse IA en cours</h3>
              <p className="text-sm text-neutral-500 mt-1">{loadingStep}</p>
            </div>
            <div className="max-w-md mx-auto bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-600 space-y-2 text-left">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Segmentation sémantique du manuscrit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span>Identification des choix architecturaux & bases de données</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Attribution des rôles du jury (Président, Technique, Critique)</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl flex items-center gap-3">
                <IconAlertTriangle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Document Upload Area */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Report File */}
              <div
                onClick={() => reportInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  reportFile
                    ? "border-emerald-500 bg-emerald-50/30"
                    : "border-neutral-300 hover:border-primary-400 bg-neutral-50/50"
                }`}
              >
                <input
                  ref={reportInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleReportChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-2">
                  <IconFileText size={20} />
                </div>
                <p className="text-sm font-semibold text-neutral-800">
                  {reportFile ? reportFile.name : "Rapport de PFE / Thèse (PDF ou DOCX)"}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {reportFile
                    ? `${(reportFile.size / (1024 * 1024)).toFixed(1)} Mo — Prêt pour analyse`
                    : "Glissez votre document ou cliquez pour parcourir (max 40 Mo)"}
                </p>
              </div>

              {/* Slides File (Optional) */}
              <div
                onClick={() => slidesInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  slidesFile
                    ? "border-indigo-500 bg-indigo-50/30"
                    : "border-neutral-300 hover:border-primary-400 bg-neutral-50/50"
                }`}
              >
                <input
                  ref={slidesInputRef}
                  type="file"
                  accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handleSlidesChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-2">
                  <IconUpload size={20} />
                </div>
                <p className="text-sm font-semibold text-neutral-800">
                  {slidesFile ? slidesFile.name : "Slides de Présentation (Optionnel)"}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {slidesFile
                    ? `${(slidesFile.size / (1024 * 1024)).toFixed(1)} Mo — Diapositives chargées`
                    : "Support PowerPoint ou PDF de la soutenance (max 40 Mo)"}
                </p>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Titre du Projet *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Plateforme d'évaluation intelligente et détection d'anomalies..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Résumé ou Problématique Principale
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm rounded-lg border border-neutral-300 p-3 focus:outline-hidden focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="Précisez succinctement le contexte métier et les défis majeurs traités..."
                />
              </div>
            </div>

            {/* Level, Category, Duration */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Niveau Académique
                </label>
                <select
                  value={academicLevel}
                  onChange={(e) => setAcademicLevel(e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 p-2.5 bg-white focus:border-primary-500"
                >
                  <option value="Ingénieur">Cycle Ingénieur</option>
                  <option value="Master">Master / Magistère</option>
                  <option value="Licence">Licence Professionnelle</option>
                  <option value="Doctorat">Thèse de Doctorat</option>
                  <option value="Autre">Autre diplôme</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Domaine
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 p-2.5 bg-white focus:border-primary-500"
                >
                  <option value="Génie Logiciel">Génie Logiciel & Web</option>
                  <option value="IA & Data Science">IA & Data Science</option>
                  <option value="Cybersécurité">Cybersécurité & Réseaux</option>
                  <option value="Systèmes Embarqués">Systèmes Embarqués / IoT</option>
                  <option value="Systèmes d'Information">Systèmes d'Information</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Durée Cible
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-neutral-300 p-2.5 bg-white focus:border-primary-500"
                >
                  <option value={15}>15 minutes (Express)</option>
                  <option value={20}>20 minutes (Standard PFE)</option>
                  <option value={30}>30 minutes (Approfondi)</option>
                </select>
              </div>
            </div>

            {/* Language & Difficulty */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Langue de Soutenance
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLanguage("fr")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      language === "fr" ? "bg-primary-50 border-primary-500 text-primary-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      language === "en" ? "bg-primary-50 border-primary-500 text-primary-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("ar")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      language === "ar" ? "bg-primary-50 border-primary-500 text-primary-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    🇩🇿 العربية
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Difficulté du Jury
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDifficulty("beginner")}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      difficulty === "beginner" ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    Débutant
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("intermediate")}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      difficulty === "intermediate" ? "bg-primary-50 border-primary-500 text-primary-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("expert")}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                      difficulty === "expert" ? "bg-amber-50 border-amber-500 text-amber-700 font-bold" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    Exigeant
                  </button>
                </div>
              </div>
            </div>

            {/* Simulation Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                Mode de Soutenance
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Training Mode */}
                <div
                  onClick={() => setMode("TRAINING")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    mode === "TRAINING" ? "border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="font-bold text-sm text-neutral-900 mb-1">Mode Entraînement</div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Conseils, indices et réponses modèles après chaque question pour progresser rapidement.
                  </p>
                </div>

                {/* Realistic Mode */}
                <div
                  onClick={() => setMode("REALISTIC")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    mode === "REALISTIC" ? "border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="font-bold text-sm text-neutral-900 mb-1">Mode Réel</div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Comportement académique naturel avec chronomètre et débriefing complet à la fin.
                  </p>
                </div>

                {/* Stress Test Mode */}
                <div
                  onClick={() => {
                    if (usage?.plan === "FREE") onOpenUpgrade()
                    else setMode("STRESS_TEST")
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all relative ${
                    mode === "STRESS_TEST" ? "border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/20" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {usage?.plan === "FREE" && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary-100 text-primary-700">
                      <IconLock size={11} /> Pro
                    </span>
                  )}
                  <div className="font-bold text-sm text-neutral-900 mb-1 flex items-center gap-1.5">
                    <span>Stress Test</span>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Questions pièges, relances critiques et timing serré pour tester votre résistance le jour J.
                  </p>
                </div>
              </div>
            </div>

            {/* Technologies Selector */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                Technologies & Frameworks du Projet
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUGGESTED_TECHS.map((tech) => {
                  const active = techStack.includes(tech)
                  return (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => toggleTech(tech)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-primary-600 text-white shadow-xs"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {tech}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomTech()
                    }
                  }}
                  placeholder="Ajouter une technologie (ex : Spring Cloud, Kafka...)"
                  className="flex-1 text-xs rounded-lg border border-neutral-300 px-3 py-2"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addCustomTech}>
                  Ajouter
                </Button>
              </div>
            </div>

            {/* Quota indicator */}
            {usage && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <IconShield size={16} className="text-primary-600" />
                  <span>
                    Forfait <strong>{usage.plan}</strong> :{" "}
                    <strong>{usage.monthly_simulations_remaining}</strong> simulation(s) restante(s) ce mois-ci
                  </span>
                </div>
                {usage.plan === "FREE" && (
                  <button
                    type="button"
                    onClick={onOpenUpgrade}
                    className="text-primary-600 font-semibold hover:underline cursor-pointer"
                  >
                    Débloquer l'accès illimité
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-xs cursor-pointer"
                disabled={loading}
              >
                <IconSparkles size={16} />
                Lancer l'Analyse & Préparer le Jury
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
