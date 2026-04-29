"""Doctor Authentication Routes — Register, Login, Verify (JWT-based)"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hashlib, secrets, base64, os

router = APIRouter(prefix="/api/v3/auth", tags=["Doctor Auth"])

# ── JWT-like token (simplified for demo — use python-jose in production) ─────
SECRET = os.getenv("JWT_SECRET", "rural_health_secret_key_2024")


def hash_password(pw: str) -> str:
    return hashlib.sha256((pw + SECRET).encode()).hexdigest()


def make_token(doctor_id: str, name: str) -> str:
    payload = f"{doctor_id}:{name}:{datetime.utcnow().isoformat()}"
    return base64.b64encode(payload.encode()).decode()


# ── In-memory doctor store (replace with MongoDB in production) ──────────────
DOCTORS: dict = {}  # {email: doctor_doc}
TOKENS: dict = {}  # {token: email}


# ── Models ───────────────────────────────────────────────────────────────────
class DoctorRegister(BaseModel):
    name: str
    email: str
    password: str
    hospital: str
    specialization: str
    license_number: str  # Must be unique
    phone: str


class DoctorLogin(BaseModel):
    email: str
    password: str


# ── Routes ───────────────────────────────────────────────────────────────────
@router.post("/register")
async def register_doctor(doc: DoctorRegister):
    if doc.email in DOCTORS:
        raise HTTPException(
            status_code=409, detail="Doctor already registered with this email."
        )

    # Check license uniqueness
    for d in DOCTORS.values():
        if d["license_number"] == doc.license_number:
            raise HTTPException(
                status_code=409, detail="License number already registered."
            )

    doctor_id = f"DOC-{secrets.token_hex(4).upper()}"
    DOCTORS[doc.email] = {
        "doctor_id": doctor_id,
        "name": doc.name,
        "email": doc.email,
        "password_hash": hash_password(doc.password),
        "hospital": doc.hospital,
        "specialization": doc.specialization,
        "license_number": doc.license_number,
        "phone": doc.phone,
        "verified": False,  # Admin must verify license before access
        "joined": datetime.utcnow().isoformat(),
    }
    return {
        "status": "registered",
        "doctor_id": doctor_id,
        "message": "Registration received. Your license is being verified — you'll receive access within 24 hours.",
    }


@router.post("/login")
async def login_doctor(creds: DoctorLogin):
    doc = DOCTORS.get(creds.email)
    if not doc or doc["password_hash"] != hash_password(creds.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not doc["verified"]:
        raise HTTPException(
            status_code=403,
            detail="Account pending verification. Please wait for admin approval.",
        )

    token = make_token(doc["doctor_id"], doc["name"])
    TOKENS[token] = creds.email
    return {
        "token": token,
        "doctor_id": doc["doctor_id"],
        "name": doc["name"],
        "hospital": doc["hospital"],
    }


@router.get("/me")
async def get_profile(token: str):
    email = TOKENS.get(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    doc = DOCTORS[email].copy()
    doc.pop("password_hash", None)
    return doc


@router.post("/admin/verify/{email}")
async def admin_verify(email: str, admin_key: str):
    """Admin-only endpoint to verify a doctor's license."""
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    if email not in DOCTORS:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    DOCTORS[email]["verified"] = True
    return {"status": "verified", "doctor": DOCTORS[email]["name"]}


@router.get("/admin/pending")
async def list_pending(admin_key: str):
    """List all unverified doctors."""
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    return [d for d in DOCTORS.values() if not d["verified"]]
