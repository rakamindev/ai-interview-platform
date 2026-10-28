import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type { WsControlMessage, TranscriptTurn, InterviewState, InterviewSpeaker } from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
}

// Note #14: Extended reconnect backoff to prevent premature auto-ending (~30s tolerance)
const RECONNECT_DELAYS = [1000, 2000, 3000, 5000, 8000, 10000];

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

    setConnectionState("connecting");
    const url = token
      ? `${WS_URL}/ws/sessions/${sessionId}/audio?token=${token}`
      : `${WS_URL}/ws/sessions/${sessionId}/audio`;
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
              // Explicit end from server
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length;
              onStateChange("complete");
              break;
            case "error":
              // Note #14: Only complete if explicitly unrecoverable AND session ended, otherwise try to recover
              if (!msg.recoverable && sessionEndedRef.current) {
                onStateChange("complete");
              } else {
                console.warn("[WebSocket] Recoverable warning or server error:", msg.message);
              }
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
      // Clean exit requested: do not reconnect
      if (sessionEndedRef.current) return;

      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        onStateChange("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAYS[attempt]);
      } else {
        // Note #14: Do NOT force session to "complete" on connection drops!
        // Instead keep in reconnecting state so user can retry or wait for internet restoration
        onStateChange("reconnecting");
      }
    };
  }, [sessionId, token, onAudioChunk, onTranscript, onStateChange, onSpeakerChange, onReconnected]);

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
    sessionEndedRef.current = true; // Mark session explicitly ended
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = RECONNECT_DELAYS.length;
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
