import { useState, useEffect, useRef } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Primitives"
import { 
  IconSparkles, IconClock, IconMicrophone, IconMicrophoneOff, 
  IconCheck, IconLightbulb, IconAward, IconAlertTriangle, 
  IconChevronRight, IconPlay, IconX, IconShield 
} from "../../components/ui/Icons"
import { 
  api, type SimulationDetail, type MockDefenseQuestion, 
  type AnswerEvaluation, type User 
} from "../../lib/api"

export function LiveDefenseSession({
  simulationId,
  onFinish,
  onExit,
  user: _user,
}: {
  simulationId: string
  onFinish: (simulationId: string) => void
  onExit: () => void
  user?: User | null
}) {
  const [simulation, setSimulation] = useState<SimulationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Active question state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answerText, setAnswerText] = useState("")
  const [answerMode, setAnswerMode] = useState<"text" | "voice">("text")
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [followUpAlert, setFollowUpAlert] = useState<string | null>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const voiceTimerRef = useRef<any>(null)

  // Session timer
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [showHint, setShowHint] = useState<string | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // 1. Load Simulation
  const loadSimulation = async () => {
    setLoading(true)
    setError("")
    try {
      const sim = await api.getMockDefense(simulationId)
      // If ready, start it
      if (sim.status === "READY") {
        const started = await api.startMockDefenseSession(simulationId)
        setSimulation(started)
        setCurrentIdx(started.current_question_index || 0)
      } else {
        setSimulation(sim)
        setCurrentIdx(Math.min(sim.questions.length - 1, sim.current_question_index || 0))
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement de la soutenance.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSimulation()
  }, [simulationId])

  // 2. Global session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 3. Web Speech API Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true

    // Map language
    const lang = simulation?.language === "en" ? "en-US" : simulation?.language === "ar" ? "ar-SA" : "fr-FR"
    recognition.lang = lang

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " "
        }
      }
      if (finalTranscript) {
        setAnswerText((prev) => (prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()))
      }
    }

    recognition.onerror = (e: any) => {
      console.warn("Speech recognition error:", e)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    }
  }, [simulation?.language])

  const toggleRecording = () => {
    if (!voiceSupported) {
      alert("La reconnaissance vocale directe n'est pas supportée sur ce navigateur. Utilisez le mode texte.")
      return
    }

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    } else {
      setVoiceDuration(0)
      try {
        recognitionRef.current?.start()
        setIsRecording(true)
        voiceTimerRef.current = setInterval(() => {
          setVoiceDuration((prev) => prev + 1)
        }, 1000)
      } catch (err) {
        console.error("Failed to start voice recognition:", err)
      }
    }
  }

  // Current Question
  const currentQ: MockDefenseQuestion | undefined = simulation?.questions[currentIdx]

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!currentQ || !answerText.trim() || !simulation) return
    if (isRecording) {
      toggleRecording()
    }

    setSubmitting(true)
    setError("")
    try {
      const res = await api.submitMockDefenseAnswer(simulation.id, {
        question_id: currentQ.id,
        answer: answerText.trim(),
        answer_mode: answerMode,
        audio_duration_seconds: answerMode === "voice" ? Math.max(5, voiceDuration) : undefined,
      })

      // Update question in local state
      const updatedQuestions = [...simulation.questions]
      updatedQuestions[currentIdx] = res.question

      // If follow-up injected
      if (res.has_follow_up && res.follow_up_question) {
        updatedQuestions.splice(currentIdx + 1, 0, res.follow_up_question)
        setFollowUpAlert(
          "Le jury a été stimulé par votre réponse et a immédiatement posé une question de relance !"
        )
      }

      setSimulation({
        ...simulation,
        questions: updatedQuestions,
        current_question_index: res.current_question_index,
      })

      setCurrentEvaluation(res.evaluation)
      setShowFeedbackModal(true)
      setAnswerText("")
      setVoiceDuration(0)
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la soumission de la réponse.")
    } finally {
      setSubmitting(false)
    }
  }

  // Move to next question or finalize
  const handleProceedNext = async () => {
    setShowFeedbackModal(false)
    setCurrentEvaluation(null)
    setFollowUpAlert(null)
    setShowHint(null)

    if (!simulation) return

    // If next question exists, advance
    if (currentIdx + 1 < simulation.questions.length) {
      setCurrentIdx(currentIdx + 1)
    } else {
      // Conclude session and build final report
      setLoading(true)
      try {
        await api.finishMockDefense(simulation.id)
        onFinish(simulation.id)
      } catch (err: any) {
        setError(err?.message || "Erreur lors de la clôture de la soutenance.")
        setLoading(false)
      }
    }
  }

  // Request Hint
  const handleRequestHint = async () => {
    if (!currentQ || !simulation) return
    if (simulation.mode === "STRESS_TEST") {
      alert("Les indices sont strictement désactivés en Mode Stress Test.")
      return
    }

    setHintLoading(true)
    try {
      const res = await api.getMockDefenseHint(simulation.id, currentQ.id)
      setShowHint(res.hint)
    } catch (err: any) {
      alert(err?.message || "Impossible de récupérer l'indice.")
    } finally {
      setHintLoading(false)
    }
  }

  // Early terminate session
  const handleEarlyFinish = async () => {
    if (!simulation) return
    setLoading(true)
    try {
      await api.finishMockDefense(simulation.id)
      onFinish(simulation.id)
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la finalisation.")
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 border-3 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <h3 className="font-bold text-neutral-800 text-lg">Initialisation de la session</h3>
        <p className="text-xs text-neutral-500">Le jury virtuel prépare votre soutenance...</p>
      </div>
    )
  }

  if (!simulation || !currentQ) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200 max-w-lg mx-auto space-y-4">
        <IconAlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h3 className="font-bold text-neutral-800">Aucune question active trouvée</h3>
        <p className="text-xs text-neutral-500">{error || "La simulation a peut-être déjà été clôturée."}</p>
        <Button variant="secondary" onClick={onExit}>Retour à la liste</Button>
      </div>
    )
  }

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const progressPct = Math.round(((currentIdx + 1) / simulation.questions.length) * 100)

  // Current examiner role styling
  const examinerBg =
    currentQ.examiner_role === "PRESIDENT"
      ? "from-primary-900 to-indigo-950 border-primary-700"
      : currentQ.examiner_role === "TECHNICAL"
      ? "from-indigo-900 to-slate-950 border-indigo-700"
      : "from-amber-950 to-neutral-900 border-amber-800"

  const roleBadge =
    currentQ.examiner_role === "PRESIDENT"
      ? "bg-primary-100 text-primary-800"
      : currentQ.examiner_role === "TECHNICAL"
      ? "bg-indigo-100 text-indigo-800"
      : "bg-amber-100 text-amber-800"

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Session Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-2 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Quitter la session"
          >
            <IconX size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-neutral-900 truncate max-w-xs sm:max-w-md">
              {simulation.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
              <span className="font-semibold text-primary-700">
                Question {currentIdx + 1} sur {simulation.questions.length}
              </span>
              <span>•</span>
              <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                {simulation.mode === "TRAINING" ? "Entraînement" : simulation.mode === "REALISTIC" ? "Mode Réel" : "Stress Test"}
              </span>
            </div>
          </div>
        </div>

        {/* Timer & Finish Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-xl text-neutral-700 text-xs font-mono font-bold">
            <IconClock size={15} className="text-neutral-500" />
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExitConfirm(true)}
            className="text-xs text-danger-700 hover:bg-danger-50 border-danger-200"
          >
            Terminer
          </Button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-primary-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Follow-up Question Alert */}
      {followUpAlert && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <IconSparkles size={16} className="text-amber-600 flex-shrink-0" />
            <span>{followUpAlert}</span>
          </div>
          <button onClick={() => setFollowUpAlert(null)} className="text-amber-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* Current Examiner Speech Card */}
      <div className={`rounded-3xl bg-gradient-to-br ${examinerBg} p-6 sm:p-8 text-white shadow-xl border relative overflow-hidden transition-all duration-300`}>
        <div className="relative z-10 space-y-5">
          {/* Examiner Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-lg font-bold">
                {currentQ.examiner_name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h3 className="font-bold text-base text-white">{currentQ.examiner_name}</h3>
                <p className="text-xs text-primary-200">{currentQ.examiner_title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${roleBadge}`}>
                {currentQ.examiner_role === "PRESIDENT"
                  ? "Président"
                  : currentQ.examiner_role === "TECHNICAL"
                  ? "Examinateur Technique"
                  : "Examinateur Critique"}
              </span>
            </div>
          </div>

          {/* Question Category & Text */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-white/80 text-[11px] font-semibold uppercase tracking-wider mb-3">
              {currentQ.category}
            </div>

            <blockquote className="text-lg sm:text-xl md:text-2xl font-serif font-medium leading-relaxed tracking-normal text-white drop-shadow-xs">
              « {currentQ.text} »
            </blockquote>

            {currentQ.context_grounding && (
              <p className="text-xs text-white/60 mt-3 italic flex items-center gap-1.5">
                <IconShield size={13} className="text-primary-300 flex-shrink-0" />
                <span>Justification : {currentQ.context_grounding}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hint Alert (if requested) */}
      {showHint && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <IconLightbulb size={16} />
            <span>Indice Pédagogique :</span>
          </div>
          <p className="leading-relaxed pl-6">{showHint}</p>
        </div>
      )}

      {/* Answer Form */}
      <Card className="!p-6 space-y-4 border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Votre Réponse Orale / Écrite
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnswerMode("text")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                answerMode === "text"
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Mode Texte
            </button>
            <button
              type="button"
              onClick={() => setAnswerMode("voice")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                answerMode === "voice"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              <IconMicrophone size={14} />
              Mode Vocal (Micro)
            </button>
          </div>
        </div>

        {/* Voice Mode Area */}
        {answerMode === "voice" && (
          <div className="p-4 bg-primary-50/40 border border-primary-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary-900">
                <IconMicrophone size={16} className={isRecording ? "text-danger-600 animate-pulse" : "text-primary-600"} />
                <span>
                  {isRecording ? `Enregistrement en cours (${formatTimer(voiceDuration)})` : "Prêt pour la réponse vocale"}
                </span>
              </div>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-danger-600 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger-600 animate-ping" />
                  MICRO ACTIF
                </span>
              )}
            </div>

            <div className="flex items-center justify-center py-3">
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                  isRecording
                    ? "bg-danger-600 hover:bg-danger-700 text-white ring-8 ring-danger-100 animate-pulse"
                    : "bg-primary-600 hover:bg-primary-700 text-white ring-4 ring-primary-100"
                }`}
                title={isRecording ? "Arrêter la dictée" : "Démarrer la dictée vocale"}
              >
                {isRecording ? <IconMicrophoneOff size={24} /> : <IconMicrophone size={24} />}
              </button>
            </div>

            <p className="text-center text-[11px] text-neutral-500">
              {isRecording
                ? "Parlez distinctement face à votre micro. Vos propos sont transcrits en temps réel ci-dessous."
                : "Cliquez sur le micro pour démarrer votre argumentation orale."}
            </p>
          </div>
        )}

        {/* Text Area */}
        <div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            disabled={submitting}
            rows={5}
            placeholder={
              answerMode === "voice"
                ? "Votre transcription orale apparaîtra ici. Vous pouvez également ajuster le texte manuellement..."
                : "Exposez votre raisonnement, justifiez vos choix architecturaux et citez vos arguments concrets..."
            }
            className="w-full text-sm rounded-xl border border-neutral-300 p-4 focus:outline-hidden focus:border-primary-500 focus:ring-3 focus:ring-primary-100 transition-all font-body leading-relaxed"
          />

          <div className="flex items-center justify-between text-xs text-neutral-400 mt-1.5">
            <span>
              {answerText.trim() ? `${answerText.trim().split(/\s+/).length} mots rédigés` : "0 mot"}
            </span>
            <span>Un développement de 60 à 150 mots est conseillé</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {simulation.mode !== "STRESS_TEST" ? (
            <button
              type="button"
              onClick={handleRequestHint}
              disabled={hintLoading || submitting}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1.5 p-2 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <IconLightbulb size={16} />
              <span>{hintLoading ? "Recherche d'indice..." : "Demander un Indice"}</span>
            </button>
          ) : (
            <span className="text-xs text-neutral-400 italic">Indices désactivés en mode Stress Test</span>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmitAnswer}
              disabled={submitting || !answerText.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Évaluation par le jury...</span>
                </>
              ) : (
                <>
                  <IconCheck size={18} />
                  <span>Valider ma Réponse</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Immediate Answer Feedback Modal (in Training mode or after submitting) */}
      {showFeedbackModal && currentEvaluation && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-neutral-200 overflow-hidden my-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-900 to-indigo-950 p-6 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-primary-200 font-semibold uppercase tracking-wider">
                  Retour du Jury • Question {currentIdx + 1}
                </span>
                <h3 className="text-xl font-bold font-display mt-0.5">Évaluation de votre Réponse</h3>
              </div>
              <div className="text-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-xs border border-white/20">
                <div className="text-2xl font-bold font-display">
                  {currentEvaluation.overallScore}/100
                </div>
                <div className="text-[10px] text-primary-200 uppercase font-semibold">Note</div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Examiner reaction quote */}
              {currentEvaluation.examinerFeedback && (
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs italic text-neutral-700 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    {currentQ.examiner_name[0]}
                  </div>
                  <div>
                    <span className="font-bold not-italic text-neutral-900 block mb-0.5">
                      {currentQ.examiner_name} :
                    </span>
                    « {currentEvaluation.examinerFeedback} »
                  </div>
                </div>
              )}

              {/* Rubric Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Détail par Critère Académique
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Exactitude</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.technicalAccuracy}/100
                    </span>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Profondeur</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.depthOfUnderstanding}/100
                    </span>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Raisonnement</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.reasoning}/100
                    </span>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Clarté</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.clarity}/100
                    </span>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Justification</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.justification}/100
                    </span>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                    <span className="text-[10px] text-neutral-500 block">Pertinence</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentEvaluation.criteria.completeness}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <IconCheck size={14} className="text-emerald-600" /> Points Forts
                  </span>
                  <ul className="text-xs text-emerald-800 space-y-1">
                    {currentEvaluation.strengths.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses / Missing */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <IconAlertTriangle size={14} className="text-amber-600" /> Points à Améliorer
                  </span>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {[...currentEvaluation.weaknesses, ...currentEvaluation.missingPoints].slice(0, 3).map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Improved Model Answer */}
              {currentEvaluation.improvedAnswer && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-1.5">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <IconSparkles size={14} className="text-indigo-600" /> Exemple de Réponse Modèle
                  </span>
                  <p className="text-xs text-indigo-950 leading-relaxed font-body">
                    {currentEvaluation.improvedAnswer}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {currentIdx + 1 < simulation.questions.length
                  ? `Prochaine question : ${currentIdx + 2}/${simulation.questions.length}`
                  : "Dernière question atteinte"}
              </span>

              <Button
                variant="primary"
                onClick={handleProceedNext}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold cursor-pointer"
              >
                {currentIdx + 1 < simulation.questions.length ? (
                  <>
                    <span>Question Suivante</span>
                    <IconChevronRight size={16} />
                  </>
                ) : (
                  <>
                    <IconAward size={16} />
                    <span>Clôturer & Voir le Rapport Final</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-neutral-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-neutral-900">Terminer la soutenance ?</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Vous avez répondu à {simulation.questions.filter((q) => q.evaluation).length} questions sur {simulation.questions.length}.
              Si vous clôturez maintenant, votre rapport de préparation sera généré sur la base des questions déjà traitées.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowExitConfirm(false)}>
                Continuer l'épreuve
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-danger-600 hover:bg-danger-700 text-white"
                onClick={handleEarlyFinish}
              >
                Clôturer & Générer le Rapport
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
