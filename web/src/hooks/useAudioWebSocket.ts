import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type {
  WsControlMessage,
  TranscriptTurn,
  InterviewState,
  InterviewSpeaker,
  InterviewErrorInfo,
} from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: TranscriptTurn) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
  onTiming?: (timing: { deadlineAt: string; remainingSeconds: number }) => void;
  onTakenOver?: () => void;
  /** Called when the session fails permanently (unrecoverable WS error or exhausted reconnect). */
  onFatalError?: (error: InterviewErrorInfo) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000];

export function useAudioWebSocket({
  sessionId,
  token,
  onAudioChunk,
  onTranscript,
  onStateChange,
  onSpeakerChange,
  onReconnected,
  onTiming,
  onTakenOver,
  onFatalError,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    sessionEndedRef.current = false;
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
              if (msg.deadline_at && msg.remaining_seconds !== undefined) {
                onTiming?.({
                  deadlineAt: msg.deadline_at,
                  remainingSeconds: msg.remaining_seconds,
                });
              }
              onStateChange("active");
              break;
            case "transcription":
            case "transcript":
              if (msg.speaker && msg.text) {
                onTranscript({
                  id: msg.turn_id ?? msg.turn_number ?? 0,
                  turn_number: msg.turn_number ?? 0,
                  speaker: msg.speaker === "candidate" ? "candidate" : "ai",
                  text: msg.text,
                  created_at: new Date().toISOString(),
                });
              }
              break;
            case "session_in_use":
              onStateChange("in_use");
              break;
            case "session_taken_over":
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length;
              onTakenOver?.();
              onStateChange("taken_over");
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
              onStateChange("active");
              onReconnected?.();
              break;
            case "session_ended":
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // suppress reconnect
              onStateChange("complete");
              break;
            case "error":
              if (!msg.recoverable) {
                onFatalError?.({
                  kind: "ws_unrecoverable",
                  code: msg.code,
                  message: msg.message,
                  recoverable: false,
                });
                onStateChange("error");
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
        onFatalError?.({
          kind: "ws_connection_lost",
          message: "The connection to the interview was lost and could not be restored.",
          recoverable: true,
        });
        onStateChange("error");
      }
    };
  }, [
    sessionId,
    token,
    onAudioChunk,
    onTranscript,
    onStateChange,
    onSpeakerChange,
    onReconnected,
    onTiming,
    onTakenOver,
    onFatalError,
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
    reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // prevent reconnect
    // Intentional close (candidate ended the interview). The backend replies
    // with session_ended, but we close immediately after sending end_session,
    // so that reply never arrives — mark the session ended ourselves so the
    // async onclose doesn't surface a spurious "connection lost" fatal error.
    sessionEndedRef.current = true;
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
