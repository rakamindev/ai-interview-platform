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
  onStopPlayback?: () => void;
  onReconnected?: () => void;
  /**
   * Called instead of onStateChange("complete") whenever the interview ends
   * WITHOUT server confirmation (reconnect budget exhausted, unrecoverable
   * error frame). Callers must never render a success screen from this.
   */
  onFailure?: (info: { reason: "connection_lost" | "server_error"; message?: string }) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000];

export function useAudioWebSocket({
  sessionId,
  token,
  onAudioChunk,
  onTranscript,
  onStateChange,
  onSpeakerChange,
  onStopPlayback,
  onReconnected,
  onFailure,
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
              onStateChange("active");
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
            case "stop_playback":
              aiSpeakingSignalled = false;
              onSpeakerChange("candidate");
              onStopPlayback?.();
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
              // An unrecoverable error frame means the backend has already
              // decided this session cannot continue. There is nothing to
              // return to — hand off to the failure screen, never success.
              if (!msg.recoverable) {
                reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // suppress reconnect
                onFailure?.({ reason: "server_error", message: msg.message ?? msg.reason });
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
        // Reconnect budget exhausted. The interview is NOT complete — we never
        // received a session_ended frame from the backend. Report failure so
        // the UI can tell the candidate the truth.
        onFailure?.({ reason: "connection_lost" });
      }
    };
  }, [sessionId, token, onAudioChunk, onTranscript, onStateChange, onSpeakerChange, onReconnected, onFailure]);

  const send = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    }
  }, []);

  /** Returns true only if the frame was actually handed to an open socket. */
  const sendJson = useCallback((payload: object): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // prevent reconnect
    wsRef.current?.close();
  }, []);

  /** Lets an explicit user-driven retry start a fresh reconnect budget. */
  const resetReconnectBudget = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, send, sendJson, disconnect, resetReconnectBudget, connectionState };
}
