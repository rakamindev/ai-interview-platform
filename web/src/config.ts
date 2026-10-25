const API_PORT = import.meta.env.VITE_API_PORT ?? "3001";
const hostname = window.location.hostname;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? `http://${hostname}:${API_PORT}/api/v1`;
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ?? `ws://${hostname}:${API_PORT}`;
