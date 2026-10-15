import { useEffect, useState } from "react";

/** Whole seconds since `startedAt` (ms epoch), ticking once a second; 0 when null. */
export function useElapsedSeconds(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return startedAt == null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}
