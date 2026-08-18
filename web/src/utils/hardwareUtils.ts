// Hardware utilities for system detection and camera access

export enum ProctoringState {
  WAITING = "waiting",
  LOADING = "loading",
  PASSED = "passed",
  ERROR = "error",
}

export type HardwareCheckingProgress = {
  osAndBrowser: ProctoringState;
  internet: ProctoringState;
  camera: ProctoringState;
  audio: ProctoringState;
  microphone: ProctoringState;
};

export function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  let browser = "Unknown";
  let version = "";
  if (/chrome|crios|crmo/i.test(userAgent)) {
    browser = "Chrome";
    version = userAgent.match(/(chrome|crios|crmo)\/([\d.]+)/i)?.[2] || "";
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = "Firefox";
    version = userAgent.match(/(firefox|fxios)\/([\d.]+)/i)?.[2] || "";
  } else if (/safari/i.test(userAgent)) {
    browser = "Safari";
    version = userAgent.match(/version\/([\d.]+)/i)?.[1] || "";
  } else if (/edg/i.test(userAgent)) {
    browser = "Edge";
    version = userAgent.match(/edg\/([\d.]+)/i)?.[1] || "";
  }
  return { browser, version };
}

export function getOSInfo() {
  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  let os = "Unknown";
  if (/Win/i.test(platform)) os = "Windows";
  else if (/Mac/i.test(platform)) os = "MacOS";
  else if (/Linux/i.test(platform)) os = "Linux";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = "iOS";
  return os;
}

export type MediaAccessError = "permission_denied" | "not_found" | "not_readable" | "unknown";

export interface MediaAccessResult {
  stream: MediaStream | null;
  error: MediaAccessError | null;
}

function classifyMediaError(err: unknown): MediaAccessError {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not_found";
  if (name === "NotReadableError") return "not_readable";
  return "unknown";
}

export async function requestUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaAccessResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null };
  } catch (err) {
    return { stream: null, error: classifyMediaError(err) };
  }
}

export async function checkCamera(): Promise<MediaAccessResult> {
  return requestUserMedia({
    video: {
      width: { max: 640 },
      height: { max: 480 },
      frameRate: { max: 20 },
      facingMode: "user",
    },
    audio: true,
  });
}

export function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getCurrentDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
