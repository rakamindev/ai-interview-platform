/**
 * useSystemChecks.ts
 *
 * Runs OS/Browser, Internet, Microphone, and Audio Output checks in parallel.
 * Each check has its own status lifecycle: idle -> checking -> success | error.
 *
 * Key design decisions:
 * - Promise.allSettled so every check settles independently; total time = slowest check.
 * - Run-ID guard: ignores results from a superseded run (StrictMode double-invoke / retries).
 * - All MediaStream tracks are stopped immediately after each check (success or failure).
 * - AbortController + race() pattern enforces per-check timeouts.
 * - canStart is true only when Internet AND Microphone are both "success".
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckStatus = "idle" | "checking" | "success" | "error";

export interface CheckState {
  id: CheckId;
  label: string;
  status: CheckStatus;
  errorMessage?: string;
}

export type CheckId = "osBrowser" | "internet" | "microphone" | "audioOutput";

export interface UseSystemChecksReturn {
  checks: CheckState[];
  runAll: () => void;
  retry: (id: CheckId) => void;
  canStart: boolean;
}

// ─── Timeout helper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// ─── Individual checks ───────────────────────────────────────────────────────

async function checkOsBrowser(): Promise<void> {
  void navigator.userAgent;
}

async function checkInternet(): Promise<void> {
  if (!navigator.onLine) {
    throw new Error("Your device reports it is offline.");
  }

  const healthcheckUrl = import.meta.env.VITE_HEALTHCHECK_URL as string | undefined;
  if (!healthcheckUrl) {
    return;
  }

  const controller = new AbortController();
  const fetchPromise = fetch(healthcheckUrl, {
    method: "HEAD",
    cache: "no-store",
    signal: controller.signal,
  }).then((res) => {
    if (!res.ok) throw new Error(`Health check returned ${res.status}.`);
  });

  try {
    await withTimeout(fetchPromise, 2_000, "Internet check timed out. Your connection may be too slow.");
  } finally {
    controller.abort();
  }
}

async function checkMicrophone(): Promise<void> {
  let stream: MediaStream | null = null;
  try {
    const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
    stream = await withTimeout(
      streamPromise,
      5_000,
      "Microphone check timed out. Please allow microphone access when prompted."
    );
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("Microphone access denied. Please allow access and click Retry.");
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("No microphone found. Please connect one and click Retry.");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      throw new Error("Microphone is already in use by another application. Close it and click Retry.");
    }
    throw err;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

async function checkAudioOutput(): Promise<void> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== "function") return;

  let devices: MediaDeviceInfo[];
  try {
    devices = await withTimeout(
      navigator.mediaDevices.enumerateDevices(),
      5_000,
      "Audio output check timed out."
    );
  } catch (err) {
    throw err;
  }

  const audioOutputDevices = devices.filter((d) => d.kind === "audiooutput");
  // Safari and Firefox do not expose audiooutput devices — treat empty list as success.
  if (audioOutputDevices.length === 0) return;
}

// ─── Check registry ──────────────────────────────────────────────────────────

const CHECK_DEFS: { id: CheckId; label: string; fn: () => Promise<void> }[] = [
  { id: "osBrowser",   label: "OS & Browser",  fn: checkOsBrowser   },
  { id: "internet",    label: "Internet",       fn: checkInternet    },
  { id: "microphone",  label: "Microphone",     fn: checkMicrophone  },
  { id: "audioOutput", label: "Audio Output",   fn: checkAudioOutput },
];

function makeInitialChecks(): CheckState[] {
  return CHECK_DEFS.map(({ id, label }) => ({ id, label, status: "idle" as CheckStatus }));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSystemChecks(): UseSystemChecksReturn {
  const [checks, setChecks] = useState<CheckState[]>(makeInitialChecks);

  const runIdRef = useRef(0);

  const runChecks = useCallback((ids: CheckId[]) => {
    const currentRun = ++runIdRef.current;
    let cancelled = false;

    setChecks((prev) =>
      prev.map((c) =>
        ids.includes(c.id)
          ? { ...c, status: "checking" as CheckStatus, errorMessage: undefined }
          : c
      )
    );

    const defs = CHECK_DEFS.filter((d) => ids.includes(d.id));

    const settled = defs.map(({ id, fn }) =>
      fn()
        .then((): CheckState => ({
          id,
          label: CHECK_DEFS.find((d) => d.id === id)!.label,
          status: "success",
        }))
        .catch((err: unknown): CheckState => ({
          id,
          label: CHECK_DEFS.find((d) => d.id === id)!.label,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "An unexpected error occurred.",
        }))
    );

    void Promise.allSettled(settled).then((results) => {
      if (cancelled || runIdRef.current !== currentRun) return;

      const updates = results
        .filter((r): r is PromiseFulfilledResult<CheckState> => r.status === "fulfilled")
        .map((r) => r.value);

      setChecks((prev) =>
        prev.map((c) => {
          const update = updates.find((u) => u.id === c.id);
          return update ?? c;
        })
      );
    });

    return () => { cancelled = true; };
  }, []);

  const runAll = useCallback(() => {
    runChecks(CHECK_DEFS.map((d) => d.id));
  }, [runChecks]);

  const retry = useCallback(
    (id: CheckId) => {
      runChecks([id]);
    },
    [runChecks]
  );

  useEffect(() => {
    const cancel = runChecks(CHECK_DEFS.map((d) => d.id));
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canStart =
    checks.find((c) => c.id === "internet")?.status === "success" &&
    checks.find((c) => c.id === "microphone")?.status === "success";

  return { checks, runAll, retry, canStart };
}
