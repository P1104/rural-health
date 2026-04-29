"""
Sarvam AI Integration — STT & TTS for Indian Languages
Docs: https://docs.sarvam.ai/
Supports: kn-IN, hi-IN, ta-IN, te-IN, bn-IN, mr-IN, gu-IN, en-IN
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
import httpx, os, base64

router = APIRouter(prefix="/api/v3/sarvam", tags=["Sarvam AI"])

SARVAM_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE = "https://api.sarvam.ai"

LANG_MAP = {
    "kn": "kn-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "bn": "bn-IN",
    "en": "en-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
}


@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    lang: str = Form(default="kn"),
):
    """
    Convert patient's spoken audio to text using Sarvam STT.
    Supports all major Indian languages.
    """
    if not SARVAM_KEY:
        raise HTTPException(
            status_code=503,
            detail="SARVAM_API_KEY not configured. Set it in backend/.env",
        )

    audio_bytes = await audio.read()
    lang_code = LANG_MAP.get(lang, "kn-IN")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SARVAM_BASE}/speech-to-text",
            headers={"api-subscription-key": SARVAM_KEY},
            files={
                "file": (audio.filename, audio_bytes, audio.content_type or "audio/wav")
            },
            data={
                "language_code": lang_code,
                "model": "saarika:v2",  # Best Sarvam STT model
                "with_timestamps": "false",
                "with_disfluencies": "false",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code, detail=f"Sarvam STT error: {resp.text}"
        )

    result = resp.json()
    transcript = result.get("transcript", "")
    return {"transcript": transcript, "language": lang_code}


@router.post("/tts")
async def text_to_speech(body: dict):
    """
    Convert text advice to speech in the patient's regional language.
    Returns base64-encoded audio for browser playback.
    """
    text: str = body.get("text", "")
    lang: str = body.get("lang", "kn")
    speaker: str = body.get("speaker", "anushka")  # anushka = valid female voice

    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    lang_code = LANG_MAP.get(lang, "kn-IN")
    if not SARVAM_KEY:
        return {"audio_base64": "", "lang": lang_code, "fallback": True}

    async with httpx.AsyncClient(timeout=30) as client:
        # bulbul:v2 correct payload
        try:
            resp = await client.post(
                f"{SARVAM_BASE}/text-to-speech",
                headers={
                    "api-subscription-key": SARVAM_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": [text],
                    "target_language_code": lang_code,
                    "speaker": speaker,
                    "model": "bulbul:v2",
                    "pitch": 0,
                    "pace": 1.0,
                    "loudness": 1.5,
                    "enable_preprocessing": True,
                },
            )
            print(f"Sarvam TTS ({lang_code}): HTTP {resp.status_code}")
            if resp.status_code == 200:
                audio_b64 = resp.json().get("audios", [""])[0]
                if audio_b64:
                    return {
                        "audio_base64": audio_b64,
                        "lang": lang_code,
                        "fallback": False,
                    }
                print(
                    f"Sarvam TTS: 200 OK but empty audio. Response: {resp.text[:200]}"
                )
            else:
                print(f"Sarvam TTS error: {resp.text[:300]}")
        except Exception as e:
            print(f"Sarvam TTS exception: {e}")

    return {"audio_base64": "", "lang": lang_code, "fallback": True}


@router.post("/translate")
async def translate(body: dict):
    """
    Translate symptom text or advice to/from Indian languages.
    Used for displaying AI triage advice in the patient's language.
    """
    text: str = body.get("text", "")
    source_lang: str = body.get("source", "en")
    target_lang: str = body.get("target", "kn")

    if not SARVAM_KEY:
        return {"translated": text, "fallback": True}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{SARVAM_BASE}/translate",
            headers={
                "api-subscription-key": SARVAM_KEY,
                "Content-Type": "application/json",
            },
            json={
                "input": text,
                "source_language_code": LANG_MAP.get(source_lang, "en-IN"),
                "target_language_code": LANG_MAP.get(target_lang, "kn-IN"),
                "speaker_gender": "Female",
                "mode": "classic-colloquial",  # Natural rural speech style
                "model": "mayura:v1",
                "enable_preprocessing": True,
            },
        )

    if resp.status_code != 200:
        return {"translated": text, "fallback": True}

    return {"translated": resp.json().get("translated_text", text), "fallback": False}
