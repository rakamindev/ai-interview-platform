import { useCallback, useEffect, useRef, useState } from "react";

import type { InterviewSpeaker, InterviewState, WsControlMessage } from "../schemas/interview";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: { speaker: "candidate" | "assessor"; text: string }) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000];

function getWsBaseUrl() {
  return (import.meta.env.VITE_WS_BASE_URL as string | undefined) ?? `ws://${window.location.host}`;
}

export function useAudioWebSocket({
  sessionId,
  token,
  onAudioChunk,
  onTranscript,
  onStateChange,
  onSpeakerChange,
  onReconnected,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    sessionEndedRef.current = false;
    setConnectionState("connecting");
    const url = token
      ? `${getWsBaseUrl()}/ws/sessions/${sessionId}/audio?token=${token}`
      : `${getWsBaseUrl()}/ws/sessions/${sessionId}/audio`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };

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
              break;
            case "transcription":
            case "transcript":
              if (msg.speaker && msg.text) {
                onTranscript({ speaker: msg.speaker === "candidate" ? "candidate" : "assessor", text: msg.text });
              }
              break;
            case "speaker_changed":
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
              onStateChange("reconnecting");
              break;
            case "reconnected":
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
        onStateChange("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAYS[attempt]);
      } else {
        onStateChange("complete");
      }
    };
  }, [sessionId, token, onAudioChunk, onTranscript, onStateChange, onSpeakerChange]);

  const send = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, send, sendJson, disconnect, connectionState };
}
