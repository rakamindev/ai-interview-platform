import { useEffect, useRef } from "react";

interface UsePollingOptions {
  // Stop after this many ticks and call onExhausted. Without it the hook polls
  // for as long as `active` stays true (the original behaviour).
  maxAttempts?: number;
  onExhausted?: () => void;
}

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  active: boolean,
  { maxAttempts, onExhausted }: UsePollingOptions = {}
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const onExhaustedRef = useRef(onExhausted);
  onExhaustedRef.current = onExhausted;

  useEffect(() => {
    if (!active) return;

    // The counter lives inside the effect, so every time `active` flips back to
    // true (e.g. "check again") the budget starts fresh.
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (maxAttempts !== undefined && attempts > maxAttempts) {
        clearInterval(id);
        onExhaustedRef.current?.();
        return;
      }
      // Swallow a failed tick (network blip): it still counts against the
      // budget, and the next tick tries again.
      Promise.resolve(fnRef.current()).catch(() => {});
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, active, maxAttempts]);
}
