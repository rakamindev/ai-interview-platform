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
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { await fnRef.current(); }
      catch { /* The caller owns its visible error state. Keep the retry loop alive. */ }
      finally { if (!stopped) timer = setTimeout(tick, intervalMs); }
    };
    timer = setTimeout(tick, intervalMs);
    return () => { stopped = true; clearTimeout(timer); };
  }, [intervalMs, active]);
}
