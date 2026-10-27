import { useEffect, useRef, useState, useCallback } from "react";

interface UseWakeLockOptions {
  enabled?: boolean;
  onRequest?: () => void;
  onRelease?: () => void;
  onError?: (err: Error) => void;
}

export function useWakeLock({
  enabled = true,
  onRequest,
  onRelease,
  onError,
}: UseWakeLockOptions = {}) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      Boolean((navigator as any).wakeLock?.request);
    setIsSupported(supported);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !(navigator as any).wakeLock?.request
    ) {
      return;
    }
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        return;
      }
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setIsActive(true);
      onRequest?.();

      sentinel.addEventListener("release", () => {
        setIsActive(false);
        sentinelRef.current = null;
        onRelease?.();
      });
    } catch (err: any) {
      setIsActive(false);
      sentinelRef.current = null;
      onError?.(err);
    }
  }, [onRequest, onRelease, onError]);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      // silently ignore release failure
    } finally {
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive, request: requestWakeLock, release: releaseWakeLock };
}
