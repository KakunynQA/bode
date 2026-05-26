const OPENCODE_BASE_URL = import.meta.env.VITE_OPENCODE_BASE_URL ?? 'http://localhost:4096';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5173';

export const config = {
  opencode: {
    baseUrl: OPENCODE_BASE_URL,
    healthEndpoint: `${OPENCODE_BASE_URL}/global/health`,
    eventEndpoint: `${OPENCODE_BASE_URL}/event`,
    sseReconnectMaxDelay: 30_000,
    sseReconnectBaseDelay: 1_000,
    pollingFallbackInterval: 10_000,
  },
  api: {
    baseUrl: API_BASE_URL,
    timeout: 10_000,
  },
} as const;
