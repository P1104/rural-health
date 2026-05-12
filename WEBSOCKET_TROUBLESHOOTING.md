# WebSocket 101 Error - Troubleshooting Guide

## Problem
HTTP 101 Switching Protocols error occurs when WebSocket handshake fails.

## Common Causes & Solutions

### 1. Render Free Tier Limitations
Render's free tier **sleeps after 15 minutes of inactivity**. WebSocket won't work if backend is sleeping.

**Solution**: Use HTTP polling fallback or upgrade to Render's paid tier.

### 2. CORS Issues (Cross-Origin)
Your frontend (Vercel) connects to backend (Render) - different origins.

**Solution**: Already configured in `main.py` with `allow_origins=["*"]`

### 3. Protocol Mismatch
| Frontend URL | WebSocket URL |
|-------------|---------------|
| http:// | ws:// |
| https:// | wss:// |

**Solution**: Fixed in `config.ts` - automatically converts `http` → `ws` and `https` → `wss`

### 4. Firewall/Proxy Blocking
Some corporate networks block WebSocket connections.

**Solution**: Use the polling fallback mode.

## Quick Fixes

### Option 1: Enable Polling Fallback (Recommended)
The hospital page now includes automatic fallback to HTTP polling if WebSocket fails.

### Option 2: Same-Origin Deployment
Deploy both frontend and backend on the same domain:
- Use Vercel's serverless functions for backend
- Or deploy everything to Render

### Option 3: Use Server-Sent Events (SSE)
Replace WebSocket with SSE for one-way server-to-client communication.

## Testing WebSocket Connection

Open browser console and run:
```javascript
const ws = new WebSocket('wss://rural-health.onrender.com/ws/hospital');
ws.onopen = () => console.log('✅ Connected');
ws.onerror = (e) => console.log('❌ Error:', e);
ws.onclose = (e) => console.log('🚪 Closed:', e.code, e.reason);
```

## Environment Variables

Ensure these are set in Vercel:
```
NEXT_PUBLIC_API_URL=https://rural-health.onrender.com
```

## Backend Must Be Running

Your WebSocket endpoint is at:
```
GET https://rural-health.onrender.com/ws/hospital
```

If you see HTTP 101, check:
1. Backend is awake (visit `/health` endpoint)
2. No errors in Render logs
3. WebSocket route is registered in FastAPI
