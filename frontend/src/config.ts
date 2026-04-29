/**
 * Centralized API configuration for the Rural Health App.
 * When hosting, NEXT_PUBLIC_API_URL should be set to your Render backend URL (e.g., https://your-backend.onrender.com)
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to convert http:// to ws:// for WebSockets
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
