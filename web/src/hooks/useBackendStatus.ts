import { useCallback, useEffect, useState } from "react";
import { healthApi } from "@/services/health";

export type BackendStatus = "checking" | "online" | "offline";

export function useBackendStatus(refreshMs = 30_000) {
  const [status, setStatus] = useState<BackendStatus>("checking");

  const check = useCallback(async (silent = false) => {
    if (!silent) setStatus("checking");
    try {
      await healthApi.check();
      setStatus("online");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(() => check(true), refreshMs);
    return () => clearInterval(id);
  }, [check, refreshMs]);

  const recheck = useCallback(() => check(), [check]);

  return { status, recheck };
}