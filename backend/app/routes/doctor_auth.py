"""Doctor Authentication Routes — Register, Login, Verify (JWT-based)"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib, secrets, base64, os, sys
from sqlalchemy import select

# ── Import DB components from main ───────────────────────────────────────────
try:
    if "main" in sys.modules:
        from main import Doctor, async_session, DB_AVAILABLE
    else:
        from backend.main import Doctor, async_session, DB_AVAILABLE
except ImportError:
    # Fallback for local testing if not running through main
    Doctor = None
    async_session = None
    DB_AVAILABLE = False

router = APIRouter(prefix="/api/v3/auth", tags=["Doctor Auth"])

# ── JWT-like token (simplified for demo — use python-jose in production) ─────
SECRET = os.getenv("JWT_SECRET", "rural_health_secret_key_2024")


def hash_password(pw: str) -> str:
    return hashlib.sha256((pw + SECRET).encode()).hexdigest()


def make_token(doctor_id: str, name: str) -> str:
    payload = f"{doctor_id}:{name}:{datetime.utcnow().isoformat()}"
    return base64.b64encode(payload.encode()).decode()


# ── Models ───────────────────────────────────────────────────────────────────
class DoctorRegister(BaseModel):
    name: str
    email: str
    password: str
    hospital: str
    specialization: str
    license_number: str  # Must be unique
    license_type: str = "MBBS"
    phone: str
    license_doc_url: Optional[str] = None


class DoctorLogin(BaseModel):
    email: str
    password: str


# ── Routes ───────────────────────────────────────────────────────────────────
@router.post("/register")
async def register_doctor(doc: DoctorRegister):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with async_session() as session:
        # Check email uniqueness
        result = await session.execute(select(Doctor).where(Doctor.email == doc.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=409, detail="Doctor already registered with this email."
            )

        # Check license uniqueness
        result = await session.execute(
            select(Doctor).where(Doctor.license_number == doc.license_number)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=409, detail="License number already registered."
            )

        doctor_id = f"DOC-{secrets.token_hex(4).upper()}"
        # Automated Verification Simulation
        # In a real app, this would call a government API like ABDM/NHA
        is_auto_verified = doc.license_number.startswith("REG-") or doc.license_number.startswith("MED-")
        trust_score = 4.5 if is_auto_verified else 0.0

        new_doc = Doctor(
            doctor_id=doctor_id,
            name=doc.name,
            email=doc.email,
            password_hash=hash_password(doc.password),
            hospital=doc.hospital,
            specialization=doc.specialization,
            license_number=doc.license_number,
            license_type=doc.license_type,
            phone=doc.phone,
            verified=is_auto_verified,  # Auto-verify if license matches pattern
            license_doc_url=doc.license_doc_url,
            trust_score=trust_score,
            joined=datetime.utcnow(),
        )
        session.add(new_doc)
        await session.commit()

        return {
            "status": "registered",
            "doctor_id": doctor_id,
            "message": "Registration received. Your license is being verified — you'll receive access within 24 hours.",
        }


@router.post("/login")
async def login_doctor(creds: DoctorLogin):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with async_session() as session:
        result = await session.execute(select(Doctor).where(Doctor.email == creds.email))
        doc = result.scalar_one_or_none()

        if not doc or doc.password_hash != hash_password(creds.password):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        if not doc.verified:
            raise HTTPException(
                status_code=403,
                detail="Account pending verification. Please wait for admin approval.",
            )

        token = make_token(doc.doctor_id, doc.name)
        return {
            "token": token,
            "doctor_id": doc.doctor_id,
            "name": doc.name,
            "hospital": doc.hospital,
            "specialization": doc.specialization,
        }


@router.get("/me")
async def get_profile(token: str):
    # For demo, we decode the token to get info. In production, use TOKENS table or JWT.
    try:
        decoded = base64.b64decode(token.encode()).decode()
        doctor_id, name, _ = decoded.split(":")
        
        if not DB_AVAILABLE:
             return {"doctor_id": doctor_id, "name": name, "note": "DB Offline"}

        async with async_session() as session:
            result = await session.execute(select(Doctor).where(Doctor.doctor_id == doctor_id))
            doc = result.scalar_one_or_none()
            if not doc:
                raise HTTPException(status_code=404, detail="Doctor not found.")
            
            return {
                "doctor_id": doc.doctor_id,
                "name": doc.name,
                "email": doc.email,
                "hospital": doc.hospital,
                "specialization": doc.specialization,
                "license_number": doc.license_number,
                "phone": doc.phone,
                "verified": doc.verified,
                "joined": doc.joined.isoformat() if doc.joined else None,
            }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


@router.post("/admin/verify/{email}")
async def admin_verify(email: str, admin_key: str):
    """Admin-only endpoint to verify a doctor's license."""
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with async_session() as session:
        result = await session.execute(select(Doctor).where(Doctor.email == email))
        doc = result.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found.")
        
        doc.verified = True
        await session.commit()
        return {"status": "verified", "doctor": doc.name}


@router.get("/admin/pending")
async def list_pending(admin_key: str):
    """List all unverified doctors."""
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    
    if not DB_AVAILABLE:
        return []

    async with async_session() as session:
        result = await session.execute(select(Doctor).where(Doctor.verified == False))
        pending = result.scalars().all()
        return [
            {
                "name": d.name,
                "email": d.email,
                "hospital": d.hospital,
                "specialization": d.specialization,
                "license_number": d.license_number,
                "license_doc_url": d.license_doc_url,
                "joined": d.joined.isoformat() if d.joined else None,
            }
            for d in pending
        ]
