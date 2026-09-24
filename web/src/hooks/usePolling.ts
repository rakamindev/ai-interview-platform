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
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await fnRef.current();
      } catch {
        // The consumer owns error state; keep the bounded polling loop alive.
      } finally {
        if (!cancelled) timer = setTimeout(poll, intervalMs);
      }
    };
    timer = setTimeout(poll, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intervalMs, active]);
}
