import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import { getAccessToken } from "@/stores/authAtom";
import type { CoverageMap } from "@/types";

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
  const onOpenRef = useRef<(() => void) | null>(null);
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);
  const onCloseRef = useRef<(() => void) | null>(null);
  const onErrorRef = useRef<(() => void) | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = getAccessToken();
    const ws = new WebSocket(`${WS_URL}/ws/sessions/${sessionId}/coverage`);
    wsRef.current = ws;

    const handleOpen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };
    onOpenRef.current = handleOpen;
    ws.addEventListener("open", handleOpen);

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "coverage_update") {
          setCoverageMap({ skills: msg.skills ?? [], discovered: msg.discovered ?? [] });
        } else if (msg.type === "session_status") {
          if (msg.status === "ended") {
            setSessionEnded(true);
            setSessionEndReason(msg.end_reason ?? null);
            // Stop reconnecting once session ends
            activeRef.current = false;
          }
        }
      } catch {
        // ignore malformed frames
      }
    };
    onMessageRef.current = handleMessage;
    ws.addEventListener("message", handleMessage);

    const handleClose = () => {
      setIsConnected(false);
      if (!activeRef.current) return;
      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connectRef.current();
        }, RECONNECT_DELAYS[attempt]);
      }
    };
    onCloseRef.current = handleClose;
    ws.addEventListener("close", handleClose);

    const handleError = () => {
      setIsConnected(false);
    };
    onErrorRef.current = handleError;
    ws.addEventListener("error", handleError);
  }, [sessionId]);

  // Keep connectRef in sync outside the callback to avoid self-reference in deps
  connectRef.current = connect;

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const ws = wsRef.current;
      if (ws) {
        if (onOpenRef.current) ws.removeEventListener("open", onOpenRef.current);
        if (onMessageRef.current) ws.removeEventListener("message", onMessageRef.current);
        if (onCloseRef.current) ws.removeEventListener("close", onCloseRef.current);
        if (onErrorRef.current) ws.removeEventListener("error", onErrorRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { coverageMap, sessionEnded, sessionEndReason, isConnected };
}
