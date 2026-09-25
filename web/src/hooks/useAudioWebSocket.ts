import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type {
  WsControlMessage,
  TranscriptTurn,
  InterviewState,
  InterviewSpeaker,
} from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
  onError?: (message: string) => void;
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
  onError,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  const connect = useCallback(() => {
    // Guard against both OPEN and CONNECTING to avoid spawning duplicate sockets
    // when connect() is called again before the previous handshake finishes.
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    sessionEndedRef.current = false;
    setConnectionState("connecting");
    const url = token
      ? `${WS_URL}/ws/sessions/${sessionId}/audio?token=${encodeURIComponent(token)}`
      : `${WS_URL}/ws/sessions/${sessionId}/audio`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setConnectionState("connected");
      // NOTE: reconnectAttemptsRef is intentionally NOT reset here.
      // onopen only confirms the TCP/WS handshake succeeded — it does not
      // confirm the backend session/auth is actually valid. Resetting the
      // counter here caused an infinite reconnect loop whenever the backend
      // opened then immediately closed the socket (e.g. auth failure,
      // upstream Gemini connect failure): the delay never escalated past
      // 1000ms and the "connection could not be restored" error never fired.
      // The counter is reset only once the backend confirms the session
      // via "session_started" below.
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };

    // Only signal AI speaking once per turn (first binary chunk).
    // Reset when speaker_changed:candidate arrives.
    let aiSpeakingSignalled = false;

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
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
              reconnectAttemptsRef.current = 0; // reset here — session is confirmed live
              onStateChange("active");
              break;
            case "transcription":
            case "transcript":
              if (msg.speaker && msg.text) {
                onTranscript({
                  speaker:
                    msg.speaker === "candidate" ? "candidate" : "assessor",
                  text: msg.text,
                });
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
              if (msg.reason === "error") {
                onError?.(msg.message || "The interview was interrupted. Please contact the interviewer.");
                onStateChange("error");
              } else {
                onStateChange("complete");
              }
              break;
            case "error":
              if (!msg.recoverable) {
                sessionEndedRef.current = true;
                onError?.(
                  msg.message ||
                    "The interview could not be started. Please try again.",
                );
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
      if (wsRef.current !== ws) return;
      setConnectionState("disconnected");
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
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
        onError?.(
          "The interview connection could not be restored. Please contact the interviewer.",
        );
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
    onError,
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
    sessionEndedRef.current = true;
    reconnectAttemptsRef.current = 0;
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, send, sendJson, disconnect, connectionState };
}
