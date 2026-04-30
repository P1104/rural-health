/**
 * Centralized API configuration for the Rural Health App.
 * When hosting, NEXT_PUBLIC_API_URL should be set to your Render backend URL (e.g., https://your-backend.onrender.com)
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Helper to convert http:// to ws:// for WebSockets
// Handles: http:// -> ws://, https:// -> wss://
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

// Helper to get full WebSocket URL with path
export const getWebSocketUrl = (path: string = '/ws/hospital'): string => {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE_URL}${cleanPath}`;
};
