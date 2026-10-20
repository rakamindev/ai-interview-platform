import { useEffect, useRef } from "react";

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  active: boolean
) {
  const fnRef = useRef(fn);
  const inFlightRef = useRef(false);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    // Skip a tick while the previous request is still running so a slow
    // response cannot stack overlapping polls on the same endpoint.
    const tick = async () => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        await fnRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
}
