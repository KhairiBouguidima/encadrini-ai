import re
from typing import Dict, Any, List
from app.core.config import settings

FRENCH_FILLER_WORDS = [
    r"\beuh\b", r"\bhum\b", r"\ben fait\b", r"\bgenre\b",
    r"\bdu coup\b", r"\bvoil[àa]\b", r"\bben\b", r"\bbon bah\b",
    r"\bquoi\b", r"\bdisons que\b", r"\ben gros\b"
]

ENGLISH_FILLER_WORDS = [
    r"\buh\b", r"\bum\b", r"\blike\b", r"\byou know\b",
    r"\bbasically\b", r"\bactually\b", r"\bliterally\b", r"\bso yeah\b"
]

class SpeechTranscriptionService:
    @staticmethod
    def analyze_oral_delivery(text: str, duration_seconds: float) -> Dict[str, Any]:
        """
        Analyzes pacing (words/min), duration, and filler words from the transcribed answer.
        Does NOT claim to analyze pronunciation or tone without direct acoustic spectral analysis.
        """
        clean_text = text.strip()
        words = [w for w in re.split(r"\s+", clean_text) if len(w) > 0]
        words_count = len(words)

        duration = max(1.0, float(duration_seconds)) if duration_seconds else max(1.0, words_count / 2.0)
        minutes = duration / 60.0
        wpm = round(words_count / minutes, 1)

        # Detect filler words
        detected_fillers: List[str] = []
        lower_text = clean_text.lower()
        all_filler_patterns = FRENCH_FILLER_WORDS + ENGLISH_FILLER_WORDS

        for pat in all_filler_patterns:
            matches = re.findall(pat, lower_text)
            if matches:
                detected_fillers.extend(matches)

        filler_words_count = len(detected_fillers)

        # Generate realistic pacing feedback
        if wpm < 85:
            pacing_feedback = f"Débit posé mais un peu lent ({wpm} mots/min). Essayez de dynamiser votre réponse pour capter l'attention du jury."
        elif 85 <= wpm <= 150:
            pacing_feedback = f"Débit oral excellent et maîtrisé ({wpm} mots/min). Le rythme permet au jury de bien assimiler vos arguments."
        elif 150 < wpm <= 180:
            pacing_feedback = f"Débit rapide ({wpm} mots/min). Pensez à marquer de légères pauses entre vos points clés."
        else:
            pacing_feedback = f"Débit très précipité ({wpm} mots/min). Ralentissez pour éviter de paraître déstabilisé(e)."

        if filler_words_count > 3:
            pacing_feedback += f" Attention aux tics de langage ({filler_words_count} tics détectés : {', '.join(set(detected_fillers))})."

        return {
            "duration_seconds": round(duration, 1),
            "words_count": words_count,
            "words_per_minute": wpm,
            "filler_words_count": filler_words_count,
            "filler_words_detected": list(set(detected_fillers)),
            "pacing_feedback": pacing_feedback,
        }

    @classmethod
    async def transcribe_audio_bytes(cls, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """Transcribe audio using OpenAI Whisper if API key is configured."""
        api_key = settings.OPENAI_API_KEY or ""
        if api_key and api_key not in ["", "sk-fake-key-for-dev"]:
            import requests
            try:
                files = {"file": (filename, audio_bytes, "audio/webm")}
                data = {"model": "whisper-1"}
                response = requests.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files=files,
                    data=data,
                    timeout=30,
                )
                if response.status_code == 200:
                    return response.json().get("text", "")
            except Exception as e:
                print(f"[speech-service] Whisper transcription error: {e}")

        # Fallback / mock transcript if audio endpoint hit without remote key
        return "Notre architecture est découpée en microservices avec une API Gateway assurant l'authentification JWT et la gestion des flux de données."
