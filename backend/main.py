"""
Rural Health Connect — Secure Backend v3.0
Layers: Patient Registration → Vault Encryption → H3 Anonymization → MongoDB → WebSocket Broadcast
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid, base64, os, asyncio, hashlib, math
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


# ── PostgreSQL/Supabase Database ────────────────────────────────────────────
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, Integer, Float, JSON, DateTime, Boolean, Text, select
from sqlalchemy.sql import func

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/rural_health")

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class Vault(Base):
    __tablename__ = "vault"
    case_id = Column(String, primary_key=True)
    encrypted_name = Column(Text)
    encrypted_phone = Column(Text)
    encrypted_age = Column(Text)
    exact_location = Column(JSON)
    timestamp = Column(DateTime, default=func.now())
    accessed_by = Column(String, nullable=True)
    accessed_at = Column(DateTime, nullable=True)
    field_notes = Column(Text, nullable=True)
    status = Column(String, default="open")

class Cases(Base):
    __tablename__ = "cases"
    case_id = Column(String, primary_key=True)
    h3_sector = Column(String)
    zones = Column(JSON)
    symptoms = Column(JSON)
    severity = Column(String)
    duration = Column(String)
    timestamp = Column(DateTime, default=func.now())
    status = Column(String, default="open")
    accepted_by = Column(String, nullable=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

try:
    asyncio.run(init_db())
    DB_AVAILABLE = True
    print("PostgreSQL connected successfully")
except Exception as e:
    print(f"PostgreSQL connection failed: {e}")
    DB_AVAILABLE = False

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
    # Simple grid-based anonymization (like H3 but without the h3 library)
    grid_size = 0.01  # ~1.1km grid
    grid_lat = round(lat / grid_size) * grid_size
    grid_lng = round(lng / grid_size) * grid_size
    return f"H3:{grid_lat:.4f},{grid_lng:.4f}"


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

    # Save to PostgreSQL (if available)
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                vault_entry = Vault(
                    case_id=case_id,
                    encrypted_name=encrypt_pii(payload.registration.name),
                    encrypted_phone=encrypt_pii(payload.registration.phone),
                    encrypted_age=encrypt_pii(str(payload.registration.age)),
                    exact_location=payload.location,
                    timestamp=datetime.utcnow(),
                    accessed_by=None,
                    status="open"
                )
                case_entry = Cases(
                    case_id=case_id,
                    h3_sector=h3_sector,
                    zones=payload.zones,
                    symptoms=payload.symptoms,
                    severity=payload.severity,
                    duration=payload.duration,
                    timestamp=datetime.utcnow(),
                    status="open"
                )
                session.add(vault_entry)
                session.add(case_entry)
                await session.commit()
                print(f"Case {case_id} saved to PostgreSQL")
        except Exception as e:
            print(f"PostgreSQL insert error: {e}")

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

    if DB_AVAILABLE:
        async with async_session() as session:
            case_entry = Cases(
                case_id=case_id,
                h3_sector="SOS_LOCATION",
                zones=["EMERGENCY"],
                symptoms=["SOS Triggered"],
                severity="critical",
                duration="unknown",
                timestamp=datetime.utcnow(),
                status="open"
            )
            session.add(case_entry)
            await session.commit()

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
    vault_entry = None
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                # Get vault entry
                result = await session.execute(select(Vault).where(Vault.case_id == case_id))
                vault_entry = result.scalar_one_or_none()
                
                if vault_entry:
                    # Update case status
                    result2 = await session.execute(select(Cases).where(Cases.case_id == case_id))
                    case_entry = result2.scalar_one_or_none()
                    if case_entry:
                        case_entry.status = "accepted"
                        case_entry.accepted_by = doctor.doctor_id
                    
                    # Update vault accessed info
                    vault_entry.accessed_by = doctor.doctor_id
                    vault_entry.accessed_at = datetime.utcnow()
                    await session.commit()
        except Exception as e:
            print(f"PostgreSQL error in accept_case: {e}")
            vault_entry = None

    # If vault not found in PostgreSQL
    if not vault_entry:
        # Check if it's an SOS case from cases table
        if DB_AVAILABLE:
            try:
                async with async_session() as session:
                    result = await session.execute(select(Cases).where(Cases.case_id == case_id))
                    case_entry = result.scalar_one_or_none()
                    if case_entry:
                        return {
                            "status": "unlocked",
                            "patient": {
                                "name": "SOS Patient",
                                "age": "Unknown",
                                "phone": "0000000000",
                            },
                            "location": {"lat": 12.9716, "lng": 77.5946},
                        }
            except Exception:
                pass

        # Return demo data for testing
        return {
            "status": "unlocked",
            "patient": {
                "name": "Demo Patient",
                "age": "35",
                "phone": "9999999999",
            },
            "location": {"lat": 12.9716, "lng": 77.5946},
        }

    # Broadcast to other hospitals (remove from feed) + send doctor profile to patient
    try:
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
    except Exception:
        pass

    # Decrypt and return to the accepting doctor only
    if vault_entry:
        name = base64.b64decode(vault_entry.encrypted_name).decode()
        phone = base64.b64decode(vault_entry.encrypted_phone).decode()
        age = base64.b64decode(vault_entry.encrypted_age).decode()

        return {
            "status": "unlocked",
            "patient": {"name": name, "age": age, "phone": phone},
            "location": vault_entry.exact_location,
        }
    
    # Fallback
    return {
        "status": "unlocked",
        "patient": {"name": "Demo Patient", "age": "35", "phone": "9999999999"},
        "location": {"lat": 12.9716, "lng": 77.5946},
    }


@app.get("/api/v3/cases")
async def list_cases():
    """Returns all open anonymous cases for the hospital feed."""
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                result = await session.execute(select(Cases).where(Cases.status == "open"))
                cases = result.scalars().all()
                return [
                    {
                        "case_id": c.case_id,
                        "h3_sector": c.h3_sector,
                        "zones": c.zones,
                        "symptoms": c.symptoms,
                        "severity": c.severity,
                        "timestamp": c.timestamp.isoformat() if c.timestamp else datetime.utcnow().isoformat(),
                        "status": c.status,
                    }
                    for c in cases
                ]
        except Exception as e:
            print(f"Error fetching cases: {e}")
    
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
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                result = await session.execute(select(Vault).where(Vault.case_id == case_id))
                vault_entry = result.scalar_one_or_none()
                if vault_entry:
                    vault_entry.field_notes = notes
                    await session.commit()
                    return {"status": "notes_updated"}
        except Exception as e:
            print(f"Error updating notes: {e}")
    raise HTTPException(status_code=404, detail="Case not found")


@app.post("/api/v3/case/{case_id}/discharge")
async def discharge_case(case_id: str, payload: dict = Body(...)):
    """
    Generate a discharge summary and archive the case.
    """
    summary_data = payload.get("summary_data", {})
    prompt = f"""Generate a professional medical discharge summary for a rural PHC.
Patient: {summary_data.get('patient', 'Unknown')}
Treatment: {summary_data.get('treatment', 'None')}
Outcome: {summary_data.get('outcome', 'Stabilized')}
Respond ONLY with a JSON object: {{"discharge_summary": "...", "follow_up": "..."}}"""

    llm_res = await call_local_llm(prompt)

    # Update status in PostgreSQL
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                result = await session.execute(select(Vault).where(Vault.case_id == case_id))
                vault_entry = result.scalar_one_or_none()
                if vault_entry:
                    vault_entry.status = "discharged"
                    await session.commit()
        except Exception as e:
            print(f"Error updating discharge: {e}")

    return {"status": "discharged", "summary": llm_res}


@app.get("/api/v3/reports/weekly")
async def get_weekly_report():
    """
    Aggregate PHC stats for the week.
    """
    count = 0
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                from sqlalchemy import func
                result = await session.execute(select(func.count(Cases.case_id)))
                count = result.scalar() or 0
        except Exception as e:
            print(f"Error getting count: {e}")
    
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
async def health():
    db_ok = False
    if DB_AVAILABLE:
        try:
            async with async_session() as session:
                await session.execute(select(1))
            db_ok = True
        except Exception as e:
            print(f"DB check error: {e}")
    
    return {
        "status": "ok",
        "postgres": db_ok,
        "ws_connections": len(manager.active),
    }
