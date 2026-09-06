import { useEffect, useRef } from "react";

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  active: boolean
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (id !== null) clearInterval(id);
      id = setInterval(() => {
        if (!document.hidden) {
          fnRef.current();
        }
      }, intervalMs);
    };

    const stopPolling = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fnRef.current();
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, active]);
}
