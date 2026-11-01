import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type { WsControlMessage, TranscriptTurn, InterviewState, InterviewSpeaker } from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  clientId?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onTranscriptHistory?: (turns: Pick<TranscriptTurn, "speaker" | "text">[]) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
  onSessionFailed?: (code?: string) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000];

export function useAudioWebSocket({
  sessionId,
  token,
  clientId,
  onAudioChunk,
  onTranscript,
  onTranscriptHistory,
  onStateChange,
  onSpeakerChange,
  onReconnected,
  onSessionFailed,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    sessionEndedRef.current = false;
    setConnectionState("connecting");
    const url = token
      ? `${WS_URL}/ws/sessions/${sessionId}/audio?token=${encodeURIComponent(token)}&client_id=${encodeURIComponent(clientId ?? "")}`
      : `${WS_URL}/ws/sessions/${sessionId}/audio`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
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
              // Reset the retry budget only once the backend confirms the session is live —
              // a socket that opens and is immediately rejected must not refill it.
              reconnectAttemptsRef.current = 0;
              onStateChange("active");
              break;
            case "transcription":
            case "transcript":
              if (msg.speaker && msg.text) {
                onTranscript({
                  speaker: msg.speaker === "candidate" ? "candidate" : "assessor",
                  text: msg.text,
                });
              }
              break;
            case "transcript_history":
              onTranscriptHistory?.(
                (msg.turns ?? []).map((turn) => ({
                  speaker: turn.speaker === "candidate" ? "candidate" : "assessor",
                  text: turn.text,
                })),
              );
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
              onStateChange("reconnecting");
              break;
            case "reconnected":
              reconnectAttemptsRef.current = 0;
              onStateChange("active");
              onReconnected?.();
              break;
            case "session_ended":
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // suppress reconnect
              if (msg.reason === "error") onSessionFailed?.();
              onStateChange("complete");
              break;
            case "error":
              if (!msg.recoverable) {
                // Backend rejected the session (e.g. auth_failed, session already ended) —
                // reconnecting would only be rejected again.
                sessionEndedRef.current = true;
                reconnectAttemptsRef.current = RECONNECT_DELAYS.length;
                onSessionFailed?.(msg.code);
                onStateChange("complete");
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
      if (sessionEndedRef.current) return; // session ended cleanly — do not reconnect
      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        onStateChange("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAYS[attempt]);
      } else {
        onSessionFailed?.();
        onStateChange("complete");
      }
    };
  }, [
    sessionId,
    token,
    clientId,
    onAudioChunk,
    onTranscript,
    onTranscriptHistory,
    onStateChange,
    onSpeakerChange,
    onReconnected,
    onSessionFailed,
  ]);

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
    sessionEndedRef.current = true; // intentional close — do not reconnect or report failure
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      sessionEndedRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  return { connect, send, sendJson, disconnect, connectionState };
}
