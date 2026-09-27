import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type { WsControlMessage, TranscriptTurn, InterviewState, InterviewSpeaker } from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  resumptionToken?: string | null;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
  onResumptionToken?: (token: string) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000];

export function useAudioWebSocket({
  sessionId,
  token,
  resumptionToken,
  onAudioChunk,
  onTranscript,
  onStateChange,
  onSpeakerChange,
  onReconnected,
  onResumptionToken,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    sessionEndedRef.current = false;
    setConnectionState("connecting");

    const storedResumptionToken =
      (token && typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(`resumption_token_${token}`)
        : null) ||
      resumptionToken ||
      null;

    if (typeof window !== "undefined") {
      (window as any).__lastConnectedResumptionToken = storedResumptionToken;
    }

    let url = token
      ? `${WS_URL}/ws/sessions/${sessionId}/audio?token=${token}`
      : `${WS_URL}/ws/sessions/${sessionId}/audio`;

    if (storedResumptionToken) {
      url += `&resumption_token=${encodeURIComponent(storedResumptionToken)}`;
    }

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      const wasReconnecting = isReconnectingRef.current || reconnectAttemptsRef.current > 0;
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      if (token) {
        ws.send(
          JSON.stringify({
            type: "auth",
            token,
            resumption_token: storedResumptionToken,
          })
        );
      }
      if (wasReconnecting) {
        isReconnectingRef.current = false;
        onStateChange("active");
        onReconnected?.();
      }
    };

    // Only signal AI speaking once per turn (first binary chunk).
    // Reset when speaker_changed:candidate arrives.
    let aiSpeakingSignalled = false;

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onAudioChunk(event.data);
        if (!aiSpeakingSignalled) {
          aiSpeakingSignalled = true;
          onSpeakerChange("ai");
        }
      } else if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data) as WsControlMessage;
          switch (msg.type) {
            case "session_started":
              onStateChange("active");
              if (isReconnectingRef.current) {
                isReconnectingRef.current = false;
                onReconnected?.();
              }
              break;
            case "session_resumption":
              if (msg.token) {
                if (token && typeof sessionStorage !== "undefined") {
                  sessionStorage.setItem(`resumption_token_${token}`, msg.token);
                }
                if (typeof window !== "undefined") {
                  (window as any).__latestResumptionToken = msg.token;
                }
                onResumptionToken?.(msg.token);
              }
              break;
            case "transcription":
            case "transcript":
              if (msg.speaker && msg.text) {
                onTranscript({ speaker: msg.speaker === "candidate" ? "candidate" : "assessor", text: msg.text });
              }
              break;
            case "speaker_changed":
              // Backend sends speaker_changed:candidate 800ms after AI finishes
              // (GATE_OPEN_DELAY) — audio playback has drained by then.
              // No async wait needed on the frontend.
              if (msg.speaker === "candidate") {
                aiSpeakingSignalled = false;
                onSpeakerChange("candidate");
              } else if (msg.speaker === "ai") {
                if (!aiSpeakingSignalled) {
                  aiSpeakingSignalled = true;
                  onSpeakerChange("ai");
                }
              }
              break;
            case "preparing_to_end":
              onStateChange("draining_audio");
              break;
            case "reconnecting":
              isReconnectingRef.current = true;
              onStateChange("reconnecting");
              break;
            case "reconnected":
              isReconnectingRef.current = false;
              onStateChange("active");
              onReconnected?.();
              break;
            case "session_ended":
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // suppress reconnect
              onStateChange("complete");
              break;
            case "error":
              if (!msg.recoverable) onStateChange("complete");
              break;
          }
        } catch {
          // Non-JSON text frame — ignore
        }
      }
    };

    ws.onerror = () => {
      setConnectionState("disconnected");
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
      if (sessionEndedRef.current) return; // session ended cleanly — do not reconnect
      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        isReconnectingRef.current = true;
        onStateChange("reconnecting");
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            reconnectAttemptsRef.current += 1;
            connect();
          }, RECONNECT_DELAYS[attempt]);
        }
      } else {
        onStateChange("complete");
      }
    };
  }, [sessionId, token, resumptionToken, onAudioChunk, onTranscript, onStateChange, onSpeakerChange, onReconnected, onResumptionToken]);

  const send = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && !isReconnectingRef.current) {
      wsRef.current.send(buffer);
    }
  }, []);

  const sendJson = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // prevent reconnect
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      if (sessionEndedRef.current) return;
      isReconnectingRef.current = true;
      onStateChange("reconnecting");
      setConnectionState("disconnected");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };

    const handleOnline = () => {
      if (sessionEndedRef.current) return;
      if (isReconnectingRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        const attempt = reconnectAttemptsRef.current;
        const delay = RECONNECT_DELAYS[attempt] || 1000;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, onStateChange]);

  return { connect, send, sendJson, disconnect, connectionState };
}
