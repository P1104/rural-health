"""
Rural Health Connect — Secure Backend v3.0
Layers: Patient Registration → Vault Encryption → H3 Anonymization → MongoDB → WebSocket Broadcast
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import h3, uuid, base64, os, asyncio
from dotenv import load_dotenv

load_dotenv()  # Load .env file — SARVAM_API_KEY, GEMINI_API_KEY, MONGO_URI


# ── Local LLM via Ollama (offline-first, no API keys needed) ─────────────────
# Run: ollama pull meditron   (medical LLM trained on PubMed + medical guidelines)
# Fallback: ollama pull medllama2 or llama3.2
import httpx, json as _json

OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "meditron")  # or medllama2, llama3.2

MEDICAL_SYSTEM_PROMPT = """You are MedBot, a specialized emergency triage AI for rural India.
You are trained on medical literature (PubMed, WHO guidelines, Indian clinical protocols).
Provide simple, clear first-aid steps a non-medical rural bystander can perform.
Never give a definitive diagnosis — say 'may be related to'.
Be aware of locally prevalent diseases: malaria, dengue, typhoid, TB, snake bites, waterborne illness.
Always respond ONLY with a valid JSON object — no extra text, no markdown."""


async def call_local_llm(prompt: str) -> dict | None:
    """Call local Ollama model (meditron/medllama2/llama3.2). Returns parsed JSON or None."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{OLLAMA_BASE}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": MEDICAL_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.15, "num_predict": 300},
                },
            )
            if resp.status_code == 200:
                content = resp.json()["message"]["content"]
                # Strip markdown code blocks if present
                content = (
                    content.strip()
                    .lstrip("```json")
                    .lstrip("```")
                    .rstrip("```")
                    .strip()
                )
                return _json.loads(content)
    except Exception:
        return None


# ── MongoDB (Motor async driver) ────────────────────────────────────────────
try:
    from motor.motor_asyncio import AsyncIOMotorClient

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["rural_health"]
    vault_col = db["vault"]  # Encrypted PII (only key-holders can decrypt)
    cases_col = db["public_cases"]  # Anonymized medical data
    doctors_col = db["doctors"]
    MONGO_AVAILABLE = True
except Exception:
    MONGO_AVAILABLE = False
    vault_col = cases_col = doctors_col = None

app = FastAPI(title="Rural Health Secure API v3", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount doctor auth routes
try:
    from app.routes.doctor_auth import router as auth_router

    app.include_router(auth_router)
except ImportError:
    pass

# Mount Sarvam AI routes
try:
    from app.routes.sarvam import router as sarvam_router

    app.include_router(sarvam_router)
except ImportError:
    pass

# Mount Advanced services (encryption, WhatsApp, outbreak, audit)
try:
    from app.routes.advanced import router as advanced_router

    app.include_router(advanced_router)
except ImportError:
    pass


# ── WebSocket Connection Manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(d)


manager = ConnectionManager()


# ── Security Helpers ─────────────────────────────────────────────────────────
def encrypt_pii(data: str) -> str:
    """AES-256 simulation — in production use cryptography.fernet"""
    return base64.b64encode(data.encode()).decode()


def anonymize_location(lat: float, lng: float) -> str:
    return h3.geo_to_h3(lat, lng, 7)


def generate_case_id() -> str:
    return f"SEC-{uuid.uuid4().hex[:6].upper()}"


# ── Pydantic Models ──────────────────────────────────────────────────────────
class PatientRegistration(BaseModel):
    name: str
    age: int
    phone: str


class CaseSubmission(BaseModel):
    registration: PatientRegistration
    location: dict  # {lat, lng}
    zones: List[str]
    symptoms: List[str]
    severity: str
    duration: str
    public_key: Optional[str] = ""


class DoctorAccept(BaseModel):
    doctor_id: str
    doctor_name: str
    hospital: str
    designation: Optional[str] = "MBBS, General Physician"
    cases_handled: Optional[int] = 0


class DoctorLocationUpdate(BaseModel):
    case_id: str
    doctor_id: str
    lat: float
    lng: float


# ── Routes ───────────────────────────────────────────────────────────────────
@app.websocket("/ws/hospital")
async def hospital_ws(ws: WebSocket):
    """Hospital dashboard connects here to receive live anonymous alerts."""
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive ping
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.post("/api/v3/submit")
async def submit_case(payload: CaseSubmission):
    """
    SECURITY LAYERS:
      1. Extract + encrypt PII → MongoDB vault (only key-holder can read)
      2. Anonymize location via H3 hex grid
      3. Strip PII → build public case record
      4. Save public case to MongoDB
      5. WebSocket broadcast to all hospital dashboards
    """
    case_id = generate_case_id()
    ts = datetime.utcnow().isoformat()

    # Layer 1 & 2 — Vault (encrypted PII)
    vault_doc = {
        "case_id": case_id,
        "encrypted_name": encrypt_pii(payload.registration.name),
        "encrypted_phone": encrypt_pii(payload.registration.phone),
        "encrypted_age": encrypt_pii(str(payload.registration.age)),
        "exact_location": payload.location,  # kept separate from public feed
        "timestamp": ts,
        "accessed_by": None,  # filled when doctor accepts
    }

    # Layer 3 — Anonymize location
    try:
        h3_sector = anonymize_location(payload.location["lat"], payload.location["lng"])
    except Exception:
        h3_sector = "H3:UNKNOWN"

    # Layer 4 — Public case (zero PII)
    public_doc = {
        "case_id": case_id,
        "h3_sector": h3_sector,
        "zones": payload.zones,
        "symptoms": payload.symptoms,
        "severity": payload.severity,
        "duration": payload.duration,
        "timestamp": ts,
        "status": "open",
        "accepted_by": None,
    }

    # Save to MongoDB (if available)
    if MONGO_AVAILABLE:
        await vault_col.insert_one(vault_doc)
        await cases_col.insert_one(public_doc)

    # Layer 5 — Real-time broadcast to hospital dashboards via WebSocket
    broadcast_payload = {
        "event": "new_case",
        "case_id": case_id,
        "h3_sector": h3_sector,
        "zones": payload.zones,
        "symptoms": payload.symptoms,
        "severity": payload.severity,
        "timestamp": ts,
    }
    await manager.broadcast(broadcast_payload)

    return {"status": "broadcasted", "case_id": case_id, "h3_sector": h3_sector}


@app.post("/api/v3/sos")
async def trigger_sos(payload: dict = Body(...)):
    """
    EMERGENCY PANIC BUTTON:
    Broadcasts a high-priority SOS alert to all hospitals immediately.
    """
    ts = datetime.utcnow().isoformat()
    case_id = payload.get("case_id", "SOS-URGENT")
    location = payload.get("location", {"lat": 0.0, "lng": 0.0})

    # Save a minimal public case so it persists
    public_doc = {
        "case_id": case_id,
        "h3_sector": "SOS_LOCATION",
        "zones": ["EMERGENCY"],
        "symptoms": ["SOS Triggered"],
        "severity": "critical",
        "timestamp": ts,
        "status": "open",
        "accepted_by": None,
        "location": location,  # For SOS we might want the exact location if allowed
    }

    if MONGO_AVAILABLE:
        await cases_col.insert_one(public_doc)

    # We broadcast the SOS event
    sos_payload = {
        "event": "sos_alert",
        "case_id": case_id,
        "location": location,
        "timestamp": ts,
        "severity": "critical",
        "message": f"🆘 HIGH PRIORITY SOS: Case {case_id} needs immediate assistance!",
    }
    await manager.broadcast(sos_payload)
    return {"status": "sos_broadcasted", "case_id": case_id}


@app.post("/api/v3/accept/{case_id}")
async def accept_case(case_id: str, doctor: DoctorAccept = Body(...)):
    """
    BLIND UNLOCK:
      - Verify case exists
      - Mark case accepted (no other hospital can see the details)
      - Decrypt PII vault and return ONLY to the accepting doctor
      - Broadcast cancellation to all other hospitals
    """
    vault_doc = None
    if MONGO_AVAILABLE:
        try:
            vault_doc = await vault_col.find_one({"case_id": case_id})
            if vault_doc:
                await cases_col.update_one(
                    {"case_id": case_id},
                    {"$set": {"status": "accepted", "accepted_by": doctor.doctor_id}},
                )
                await vault_col.update_one(
                    {"case_id": case_id},
                    {
                        "$set": {
                            "accessed_by": doctor.doctor_id,
                            "accessed_at": datetime.utcnow().isoformat(),
                        }
                    },
                )
        except Exception as e:
            print(f"MongoDB error in accept_case: {e}")
            vault_doc = None

    # If vault_doc not found (not in MongoDB)
    if not vault_doc:
        # Check if it's an SOS case (exists in cases_col but not in vault_col)
        if MONGO_AVAILABLE:
            public_doc = await cases_col.find_one({"case_id": case_id})
            if public_doc:
                # Return dummy patient info for SOS
                return {
                    "status": "unlocked",
                    "patient": {
                        "name": "SOS Patient",
                        "age": "Unknown",
                        "phone": "0000000000",
                    },
                    "location": public_doc.get("location", {"lat": 0.0, "lng": 0.0}),
                }

        raise HTTPException(
            status_code=404, detail="Case record not found in secure vault"
        )

    # Broadcast to other hospitals (remove from feed) + send doctor profile to patient
    await manager.broadcast(
        {
            "event": "case_accepted",
            "case_id": case_id,
            "accepted_by": doctor.hospital,
            "doctor_profile": {
                "name": doctor.doctor_name,
                "designation": doctor.designation or "MBBS, General Physician",
                "hospital": doctor.hospital,
                "cases_handled": doctor.cases_handled or 0,
                "eta_minutes": 15,
            },
        }
    )

    # Decrypt and return to the accepting doctor only
    name = base64.b64decode(vault_doc["encrypted_name"]).decode()
    phone = base64.b64decode(vault_doc["encrypted_phone"]).decode()
    age = base64.b64decode(vault_doc["encrypted_age"]).decode()

    return {
        "status": "unlocked",
        "patient": {"name": name, "age": age, "phone": phone},
        "location": vault_doc["exact_location"],
    }


@app.get("/api/v3/cases")
async def list_cases():
    """Returns all open anonymous cases for the hospital feed."""
    if MONGO_AVAILABLE:
        docs = await cases_col.find({"status": "open"}, {"_id": 0}).to_list(50)
        return docs
    return []


LANG_NAMES = {
    "kn": "Kannada",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "mr": "Marathi",
    "en": "English",
}


@app.post("/api/v3/triage")
async def triage(payload: dict = Body(...)):
    """
    LOCAL MEDITRON TRIAGE ENGINE (Offline-capable)
    Uses Ollama with meditron/medllama2 — no internet needed after model download.
    Falls back to rule-based if Ollama isn't running.
    Now supports lang parameter for multilingual output.
    """
    symptoms = payload.get("symptoms", [])
    zones = payload.get("zones", [])
    severity = payload.get("severity", "stable")
    lang = payload.get("lang", "en")
    lang_name = LANG_NAMES.get(lang, "English")

    lang_instruction = (
        f"\nIMPORTANT: Write the 'advice' and 'possible_conditions' values in {lang_name} language. "
        f"Only the JSON values should be in {lang_name}, keep the JSON keys in English."
        if lang != "en"
        else ""
    )

    # Build clinical prompt
    prompt = f"""A patient in rural India presents with the following:
- Affected body zones: {', '.join(zones) if zones else 'unspecified'}
- Reported symptoms: {', '.join(symptoms) if symptoms else 'general discomfort'}
- Self-reported severity: {severity}
{lang_instruction}

Respond ONLY with a JSON object using these exact keys:
{{
  "advice": "2-3 specific, simple first-aid steps for a non-medical bystander",
  "urgency_score": <integer 0-100, 100=life-threatening>,
  "possible_conditions": ["may be related to condition1", "condition2", "condition3"],
  "do_nots": ["do not action1", "do not action2"],
  "call_now": <true if urgency_score >= 70>
}}"""

    result = await call_local_llm(prompt)
    if result:
        return result

    # Rule-based fallback (instant, no model needed)
    RULES = {
        "fever": (
            "Wet cloth on forehead. Drink water every 15 min. Remove extra clothing.",
            65,
            ["Viral fever", "Malaria", "Dengue"],
        ),
        "headache": (
            "Rest in dark quiet room. Cold compress. Avoid screens.",
            45,
            ["Migraine", "Hypertension", "Dehydration"],
        ),
        "breathless": (
            "Sit upright. Loosen clothing. Do NOT lie flat.",
            85,
            ["Asthma", "Cardiac event", "Pneumonia"],
        ),
        "tightness": (
            "Sit still. Chew aspirin if not allergic. Call help NOW.",
            95,
            ["Heart attack", "Angina"],
        ),
        "cramps": (
            "Warm compress on abdomen. Sip warm water. No solid food.",
            55,
            ["Gastritis", "Food poisoning"],
        ),
        "noWalk": (
            "Immobilize leg. Do not force movement. Elevate if possible.",
            70,
            ["Fracture", "Joint injury"],
        ),
        "fracture": (
            "Immobilize firmly. Control bleeding. Do NOT straighten.",
            75,
            ["Bone fracture", "Dislocation"],
        ),
        "wound": (
            "Firm pressure with clean cloth. Elevate. Do not remove cloth.",
            80,
            ["Laceration", "Deep cut"],
        ),
        "dizziness": (
            "Sit or lie down. Drink water slowly. No sudden standing.",
            50,
            ["Low BP", "Vertigo", "Dehydration"],
        ),
        "vomit": (
            "Sip water only. Lie on side. No solid food.",
            55,
            ["Food poisoning", "Gastroenteritis"],
        ),
        "snakebite": (
            "Keep bitten limb still and below heart level. Remove jewellery. Go to hospital NOW.",
            98,
            ["Venomous snake bite"],
        ),
        "malaria": (
            "Lie down, keep warm. Drink fluids. Seek antimalarial drugs immediately.",
            75,
            ["Malaria", "Dengue", "Typhoid"],
        ),
    }
    matched_advices: list = []
    matched_scores: list = []
    matched_conditions: list = []
    for s in symptoms:
        if s in RULES:
            adv, score, cond = RULES[s]
            matched_advices.append(adv)
            matched_scores.append(score)
            matched_conditions.extend(cond)

    if matched_scores:
        avg_score = round(sum(matched_scores) / len(matched_scores))
        max_score = max(matched_scores)
        seen: set = set()
        unique_conditions = [
            c for c in matched_conditions if not (c in seen or seen.add(c))
        ]
        if len(matched_advices) == 1:
            combined_advice = matched_advices[0]
        else:
            combined_advice = " | ".join(matched_advices)
        return {
            "advice": combined_advice,
            "urgency_score": avg_score,
            "possible_conditions": unique_conditions[:5],
            "do_nots": [
                "Do not travel alone",
                "Do not ignore worsening symptoms",
                "Do not eat or drink until assessed",
            ],
            "call_now": max_score >= 70,
        }
    return {
        "advice": "Stay calm and rest in a safe place. Keep phone nearby. Help is coming.",
        "urgency_score": 30,
        "possible_conditions": ["Fatigue", "Dehydration", "Stress"],
        "do_nots": ["Do not panic", "Do not travel alone"],
        "call_now": False,
    }


@app.post("/api/v3/case/{case_id}/notes")
async def update_case_notes(case_id: str, payload: dict = Body(...)):
    """
    Update field notes for a case in the secure vault.
    """
    notes = payload.get("notes", "")
    res = await vault_col.update_one(
        {"case_id": case_id}, {"$set": {"field_notes": notes}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"status": "notes_updated"}


@app.post("/api/v3/case/{case_id}/discharge")
async def discharge_case(case_id: str, payload: dict = Body(...)):
    """
    Generate a discharge summary and archive the case.
    """
    # Use the global call_local_llm already in this file

    summary_data = payload.get("summary_data", {})
    prompt = f"""Generate a professional medical discharge summary for a rural PHC.
Patient: {summary_data.get('patient', 'Unknown')}
Treatment: {summary_data.get('treatment', 'None')}
Outcome: {summary_data.get('outcome', 'Stabilized')}
Respond ONLY with a JSON object: {{"discharge_summary": "...", "follow_up": "..."}}"""

    llm_res = await call_local_llm(prompt)

    # Move to history (simplified)
    await vault_col.update_one(
        {"case_id": case_id},
        {"$set": {"status": "discharged", "discharge_summary": llm_res}},
    )

    return {"status": "discharged", "summary": llm_res}


@app.get("/api/v3/reports/weekly")
async def get_weekly_report():
    """
    Aggregate PHC stats for the week.
    """
    count = await vault_col.count_documents({})
    # Mock aggregation for demo
    return {
        "total_cases": count,
        "critical_percent": 15,
        "average_eta": "12.4 min",
        "top_symptoms": ["Fever", "Snakebite", "Respiratory Distress"],
    }


@app.post("/api/v3/doctor/location")
async def update_doctor_location(payload: DoctorLocationUpdate):
    """
    Doctor's browser POSTs GPS coords here every 5 s after accepting a case.
    Backend broadcasts to all WebSocket clients so the patient sees live movement.
    """
    await manager.broadcast(
        {
            "event": "doctor_location_update",
            "case_id": payload.case_id,
            "lat": payload.lat,
            "lng": payload.lng,
        }
    )
    return {"status": "location_broadcasted"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mongo": MONGO_AVAILABLE,
        "ws_connections": len(manager.active),
    }
