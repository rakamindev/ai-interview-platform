import { useEffect, useRef, useState } from "react";

// `active` was the only thing that could stop this loop, and it is driven by a
// status a background job writes. No Sidekiq worker, no write, no end: with the
// worker stopped, one ended interview produced 159 requests over 7 minutes and
// no way to tell "slow" from "never".
//
// Five minutes is twice what the UI promises and past N10's three-minute budget
// in config/sidekiq.yml. After that, checking again is a deliberate act.
const DEFAULT_CEILING_MS = 5 * 60_000;

/** True once polling has been running for `ceilingMs` without `active` clearing. */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  active: boolean,
  ceilingMs: number = DEFAULT_CEILING_MS
): boolean {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) {
      setTimedOut(false);
      return;
    }

    const tick = setInterval(() => fnRef.current(), intervalMs);
    const ceiling = setTimeout(() => {
      clearInterval(tick);
      setTimedOut(true);
    }, ceilingMs);

    return () => {
      clearInterval(tick);
      clearTimeout(ceiling);
    };
  }, [intervalMs, active, ceilingMs]);

  return timedOut;
}
