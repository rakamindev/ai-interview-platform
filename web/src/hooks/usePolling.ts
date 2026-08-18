import { useEffect, useRef } from "react";

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  active: boolean
) {
  const fnRef = useRef(fn);
  const runningRef = useRef(false);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await fnRef.current();
      } catch {
        return;
      } finally {
        runningRef.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
}
