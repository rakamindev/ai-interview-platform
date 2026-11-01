const STORAGE_KEY = "interview_client_id";

export function generateId(): string {
  // getRandomValues works on plain-http origins too, unlike crypto.randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Identifies this browser to the backend, which binds an interview to the first browser that
 * starts it. Persisted so a refresh or reopened tab on the same browser can rejoin.
 */
export function getInterviewClientId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = generateId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Storage blocked (site data disabled): the id only lasts until the page is reloaded.
    return generateId();
  }
}
