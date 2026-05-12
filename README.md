# 🏥 Rural Health Connect

**A secure, offline-capable emergency health triage and dispatch platform for rural India.**

Real-time anonymized case broadcasting → doctor dispatch → live GPS tracking → encrypted patient unlock.

---

## ⚡ Quick Start (5 minutes)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # Fill in your keys (see below)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # Opens http://localhost:3000
```

### 3. Optional: Local AI Triage (Meditron)

```bash
# Install Ollama first: https://ollama.ai
ollama pull meditron          # ~4 GB download
# Then restart the backend — triage will use local LLM automatically
```

---

## 🌐 App Routes

| Route | Role | Description |
|-------|------|-------------|
| `http://localhost:3000` | Patient | 7-step emergency flow |
| `http://localhost:3000/doctor` | Doctor | Login / Register |
| `http://localhost:3000/hospital` | Hospital | Live case command center |
| `http://localhost:3000/admin` | Admin | Backend health, seed test cases |

---

## 🧪 Tester Walkthrough (Step-by-Step)

```
ROLE: PATIENT — http://localhost:3000
1. Select "Kannada" or any language → Start
2. Register: Name: Ravi, Age: 45, Phone: 9876543210
3. Body Map: Tap "Chest"
4. Symptoms: Select "Breathless" + "Tightness"
5. Severity: Select "Emergency 🔴"
6. Duration: Select "Hours"
7. Review → click "Send Help Now 🚀"
→ You should see the radar waiting screen

ROLE: DOCTOR — http://localhost:3000/hospital (open in a second tab)
8. Open the hospital page (skip doctor login for demo)
9. The case appears in the live feed within 2–3 seconds
10. Click "Accept Request"
→ Patient details decrypt (name, phone, GPS)
11. Click "📍 Open Navigation" → Google Maps opens
12. Click "💊 Write Digital Prescription" → Generate → Send to Patient's App

VERIFY ON PATIENT TAB:
✓ Patient name/phone is NOT visible in hospital feed before accepting
✓ After accepting → doctor profile appears on patient's waiting screen  
✓ Prescription received → "📋 Your prescription is ready!" toast + card
✓ Click "🐍 Rapid Snakebite Protocol" → full-screen modal (not alert())
✓ Case Timeline shows real timestamps
✓ "🟢 On Shift / 🔴 Off Shift" toggle updates Community Pulse count
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` in the `backend/` folder:

```env
# Required for real encryption
FERNET_KEY=                   # Run: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Database (leave empty to use fast in-memory mode)
DATABASE_URL=                 # postgresql+asyncpg://user:pass@host/db (Supabase URL)

# AI Vision (photo analysis)
GEMINI_API_KEY=               # Google AI Studio: https://aistudio.google.com

# Multilingual TTS (Sarvam AI)
SARVAM_API_KEY=               # https://sarvam.ai

# SMS Alerts (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional: Push Notifications
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_EMAIL=admin@yourdomain.com
```

---

## 🏗️ Architecture

```
Patient App (Next.js PWA)
    ↓ REST API / WebSocket
Backend (FastAPI)
    ├── /api/v3/submit        — Encrypt PII → Vault, anonymize location → H3
    ├── /api/v3/accept/{id}   — Decrypt PII for accepting doctor only
    ├── /api/v3/triage        — Local Meditron LLM → first-aid advice
    ├── /api/v3/outbreak/...  — H3 cluster analysis for public health
    ├── /ws/hospital          — WebSocket: case broadcasts, SOS, GPS, chat
    └── /health               — System status
    ↓
Database: Supabase PostgreSQL (or in-memory fallback)
    ├── cases   — Anonymized case data (no PII)
    └── vault   — AES-encrypted PII (unlocked per doctor)
```

---

## 🔐 Security Design

- **PII Vault**: Patient name/phone/age stored AES-encrypted in a separate `vault` table
- **H3 Anonymization**: GPS coordinates hashed to ~1km² grid cells for broadcast
- **Blind Unlock**: PII only decrypted when a specific doctor POSTs to `/accept/{id}`
- **No PII in WebSocket**: Hospital live feed never contains patient identifiers

---

## 🛠️ Key Dependencies

### Backend
```
fastapi, uvicorn, sqlalchemy, asyncpg
cryptography         # Real Fernet AES encryption
httpx                # Gemini Vision API calls
twilio               # SMS alerts
pywebpush            # Push notifications
```

### Frontend
```
next.js 14+, react
```

---

## 📁 Project Structure

```
rural-health/
├── backend/
│   ├── main.py              # Core API: submit, accept, triage, SOS, chat, shift
│   ├── app/routes/
│   │   └── advanced.py      # Gemini Vision, outbreak detection, audit logs
│   └── .env.example
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Patient flow (7 steps)
        │   ├── hospital/        # Doctor command center
        │   ├── doctor/          # Doctor login/register
        │   └── admin/           # System admin dashboard
        └── components/
            ├── SecureChat.tsx   # Persistent E2EE chat
            ├── BodyMap.tsx      # 2D anatomical body map
            ├── Human3D.tsx      # 3D model viewer
            ├── DoctorTracker.tsx # Live GPS tracking
            └── OutbreakGlobe.tsx # 3D outbreak visualization
```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend won't start | `pip install cryptography httpx` |
| Encryption warning | Set `FERNET_KEY` in `.env` |
| No cases appearing on hospital page | Check backend is running on port 8000 |
| WebSocket disconnects | Page falls back to HTTP polling automatically |
| Vitals scanner asks for camera | Allow camera permission — uses rPPG green channel |
| Gemini Vision returns generic result | Set `GEMINI_API_KEY` in `.env` |