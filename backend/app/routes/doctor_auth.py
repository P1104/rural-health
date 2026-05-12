"""Doctor Authentication Routes — Register, Login, Verify (JWT-based)

Upgrade: now uses real HS256 JWT via python-jose (falls back to Base64 if not installed).
A FastAPI dependency `get_current_doctor` is exported so protected routes
can add:  doctor = Depends(get_current_doctor)
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import hashlib, secrets, base64, os, sys

# ── Import DB components from main ───────────────────────────────────────────
try:
    if "main" in sys.modules:
        from main import Doctor, async_session, DB_AVAILABLE
    else:
        from backend.main import Doctor, async_session, DB_AVAILABLE
except ImportError:
    Doctor = None
    async_session = None
    DB_AVAILABLE = False

try:
    from sqlalchemy import select
except ImportError:
    select = None

router = APIRouter(prefix="/api/v3/auth", tags=["Doctor Auth"])

# ── JWT Setup — real HS256 via python-jose, Base64 fallback ──────────────────
SECRET = os.getenv("JWT_SECRET", "rural_health_secret_key_2024")
JWT_EXPIRE_HOURS = 12

try:
    from jose import jwt as _jwt, JWTError
    USE_REAL_JWT = True
    print("✅ Real JWT (python-jose HS256) active")
except ImportError:
    USE_REAL_JWT = False
    print("⚠️  python-jose not installed — using Base64 token fallback (install: pip install python-jose[cryptography])")


def make_token(doctor_id: str, name: str, hospital: str = "") -> str:
    if USE_REAL_JWT:
        payload = {
            "sub": doctor_id,
            "name": name,
            "hospital": hospital,
            "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
            "iat": datetime.now(timezone.utc),
        }
        return _jwt.encode(payload, SECRET, algorithm="HS256")
    # Fallback: structured Base64
    raw = f"{doctor_id}:{name}:{hospital}:{datetime.now(timezone.utc).isoformat()}"
    return base64.b64encode(raw.encode()).decode()


def decode_token(token: str) -> dict:
    """Returns dict with 'sub' (doctor_id) and 'name'. Raises HTTPException on failure."""
    if USE_REAL_JWT:
        try:
            payload = _jwt.decode(token, SECRET, algorithms=["HS256"])
            return payload
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Token invalid or expired: {e}")
    # Fallback: Base64 decode
    try:
        decoded = base64.b64decode(token.encode()).decode()
        parts = decoded.split(":")
        return {"sub": parts[0], "name": parts[1], "hospital": parts[2] if len(parts) > 2 else ""}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format.")


# ── FastAPI Dependency: get_current_doctor ────────────────────────────────────
async def get_current_doctor(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency. Add to any route:
        doctor = Depends(get_current_doctor)

    Accepts:
        Authorization: Bearer <token>
        OR
        Authorization: <token>   (for backward compat with localStorage tokens)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing. Please log in as a doctor.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token.")

    return decode_token(token)


# ── Fallback: allow doctor_id query param for backward compat (demo mode) ─────
async def get_current_doctor_or_demo(
    authorization: Optional[str] = Header(None),
    doctor_id: Optional[str] = None,
) -> dict:
    """
    Relaxed dependency — accepts JWT Header OR a doctor_id query param (demo fallback).
    Protected endpoints should prefer get_current_doctor for production.
    """
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                return decode_token(token)
            except HTTPException:
                pass

    # Demo fallback — accept any doctor_id param so existing UI keeps working
    if doctor_id:
        return {"sub": doctor_id, "name": "Doctor (Demo)", "demo": True}

    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide Authorization header or doctor_id param."
    )


def hash_password(pw: str) -> str:
    return hashlib.sha256((pw + SECRET).encode()).hexdigest()


# ── Models ───────────────────────────────────────────────────────────────────
class DoctorRegister(BaseModel):
    name: str
    email: str
    password: str
    hospital: str
    specialization: str
    license_number: str
    license_type: str = "MBBS"
    phone: str
    license_doc_url: Optional[str] = None


class DoctorLogin(BaseModel):
    email: str
    password: str


# ── In-memory doctor store (when DB unavailable) ───────────────────────────
_demo_doctors: dict = {
    "demo@health.in": {
        "doctor_id": "DOC-DEMO01",
        "name": "Dr. Demo",
        "hospital": "Rural Health Centre",
        "specialization": "General Physician",
        "password_hash": hash_password("demo1234"),
        "verified": True,
    }
}


# ── Routes ───────────────────────────────────────────────────────────────────
@router.post("/register")
async def register_doctor(doc: DoctorRegister):
    if DB_AVAILABLE and async_session and Doctor and select:
        async with async_session() as session:
            result = await session.execute(select(Doctor).where(Doctor.email == doc.email))
            if result.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Doctor already registered with this email.")
            result = await session.execute(select(Doctor).where(Doctor.license_number == doc.license_number))
            if result.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="License number already registered.")

            doctor_id = f"DOC-{secrets.token_hex(4).upper()}"
            is_auto_verified = doc.license_number.startswith("REG-") or doc.license_number.startswith("MED-")
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
                verified=is_auto_verified,
                license_doc_url=doc.license_doc_url,
                trust_score=4.5 if is_auto_verified else 0.0,
                joined=datetime.now(timezone.utc),
            )
            session.add(new_doc)
            await session.commit()
            return {"status": "registered", "doctor_id": doctor_id,
                    "message": "Registration received. Your license is being verified." if not is_auto_verified
                    else "✅ Auto-verified! You can now log in."}

    # In-memory fallback
    if doc.email in _demo_doctors:
        raise HTTPException(status_code=409, detail="Email already registered.")
    doctor_id = f"DOC-{secrets.token_hex(4).upper()}"
    _demo_doctors[doc.email] = {
        "doctor_id": doctor_id,
        "name": doc.name,
        "hospital": doc.hospital,
        "specialization": doc.specialization,
        "password_hash": hash_password(doc.password),
        "verified": True,  # Auto-verify in demo mode
    }
    return {"status": "registered", "doctor_id": doctor_id,
            "message": "✅ Registered in demo mode. You can now log in."}


@router.post("/login")
async def login_doctor(creds: DoctorLogin):
    if DB_AVAILABLE and async_session and Doctor and select:
        async with async_session() as session:
            result = await session.execute(select(Doctor).where(Doctor.email == creds.email))
            doc = result.scalar_one_or_none()
            if not doc or doc.password_hash != hash_password(creds.password):
                raise HTTPException(status_code=401, detail="Invalid email or password.")
            if not doc.verified:
                raise HTTPException(status_code=403, detail="Account pending verification.")
            token = make_token(doc.doctor_id, doc.name, doc.hospital)
            return {"token": token, "doctor_id": doc.doctor_id, "name": doc.name,
                    "hospital": doc.hospital, "specialization": doc.specialization}

    # In-memory fallback
    entry = _demo_doctors.get(creds.email)
    if not entry or entry["password_hash"] != hash_password(creds.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = make_token(entry["doctor_id"], entry["name"], entry.get("hospital", ""))
    return {"token": token, "doctor_id": entry["doctor_id"], "name": entry["name"],
            "hospital": entry.get("hospital", ""), "specialization": entry.get("specialization", "")}


@router.get("/me")
async def get_profile(doctor: dict = Depends(get_current_doctor)):
    """Returns the current doctor's profile from the JWT token."""
    doctor_id = doctor.get("sub", "")
    if DB_AVAILABLE and async_session and Doctor and select:
        try:
            async with async_session() as session:
                result = await session.execute(select(Doctor).where(Doctor.doctor_id == doctor_id))
                doc = result.scalar_one_or_none()
                if doc:
                    return {"doctor_id": doc.doctor_id, "name": doc.name, "email": doc.email,
                            "hospital": doc.hospital, "specialization": doc.specialization,
                            "verified": doc.verified, "joined": doc.joined.isoformat() if doc.joined else None}
        except Exception:
            pass
    return {"doctor_id": doctor_id, "name": doctor.get("name", "Doctor"),
            "hospital": doctor.get("hospital", ""), "note": "Token-only profile (DB offline)"}


@router.post("/admin/verify/{email}")
async def admin_verify(email: str, admin_key: str):
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    if DB_AVAILABLE and async_session and Doctor and select:
        async with async_session() as session:
            result = await session.execute(select(Doctor).where(Doctor.email == email))
            doc = result.scalar_one_or_none()
            if not doc:
                raise HTTPException(status_code=404, detail="Doctor not found.")
            doc.verified = True
            await session.commit()
            return {"status": "verified", "doctor": doc.name}
    if email in _demo_doctors:
        _demo_doctors[email]["verified"] = True
        return {"status": "verified", "doctor": _demo_doctors[email]["name"]}
    raise HTTPException(status_code=404, detail="Doctor not found.")


@router.get("/admin/pending")
async def list_pending(admin_key: str):
    if admin_key != os.getenv("ADMIN_KEY", "RURAL_ADMIN_2024"):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    if DB_AVAILABLE and async_session and Doctor and select:
        async with async_session() as session:
            result = await session.execute(select(Doctor).where(Doctor.verified == False))
            return [{"name": d.name, "email": d.email, "hospital": d.hospital,
                     "license_number": d.license_number, "joined": d.joined.isoformat() if d.joined else None}
                    for d in result.scalars().all()]
    return [e for e in _demo_doctors.values() if not e.get("verified")]
