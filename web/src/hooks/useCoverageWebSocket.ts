import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import { getStoredToken } from "@/stores/authAtom";
import type { CoverageMap } from "@/types";
import { parseCoverageUpdate } from "@/utils/coveragePayload";
import { parseSessionStatus } from "@/utils/sessionStatusPayload";

const RECONNECT_DELAYS = [1000, 2000, 4000];

interface UseCoverageWebSocketResult {
  coverageMap: CoverageMap | null;
  sessionEnded: boolean;
  sessionEndReason: string | null;
  isConnected: boolean;
}

export function useCoverageWebSocket(sessionId: number): UseCoverageWebSocketResult {
  const [coverageMap, setCoverageMap] = useState<CoverageMap | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = getStoredToken();
    const ws = new WebSocket(`${WS_URL}/ws/sessions/${sessionId}/coverage`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: unknown = JSON.parse(event.data);

        const coverageUpdate = parseCoverageUpdate(msg);
        if (coverageUpdate) {
          setCoverageMap(coverageUpdate);
          return;
        }

        const sessionStatus = parseSessionStatus(msg);
        if (!sessionStatus) return;

        if (sessionStatus.status === "ended") {
          setSessionEnded(true);
          setSessionEndReason(sessionStatus.end_reason);
          // Stop reconnecting once session ends
          activeRef.current = false;
        }
      } catch {
        // Ignore malformed JSON frames.
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!activeRef.current) return;
      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAYS[attempt]);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [sessionId]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { coverageMap, sessionEnded, sessionEndReason, isConnected };
}
