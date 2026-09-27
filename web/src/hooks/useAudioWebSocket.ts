import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import { controlMessageToState, closeDecision } from "@/utils/interviewState";
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

const RECONNECT_DELAYS = [1000, 2000, 4000];

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

          // Side-effect-only messages (no state transition).
          if (msg.type === "transcription" || msg.type === "transcript") {
            if (msg.speaker && msg.text) {
              onTranscript({ speaker: msg.speaker === "candidate" ? "candidate" : "assessor", text: msg.text });
            }
            return;
          }
          if (msg.type === "speaker_changed") {
            // Backend sends speaker_changed:candidate 800ms after AI finishes (GATE_OPEN_DELAY) —
            // audio playback has drained by then. No async wait needed on the frontend.
            if (msg.speaker === "candidate") {
              aiSpeakingSignalled = false;
              onSpeakerChange("candidate");
            } else if (msg.speaker === "ai" && !aiSpeakingSignalled) {
              aiSpeakingSignalled = true;
              onSpeakerChange("ai");
            }
            return;
          }

          // State transitions — single source of truth, unit-tested in interviewState.test.ts.
          // A failure (session_failed / non-recoverable error) resolves to a failed_* state,
          // never "complete".
          const nextState = controlMessageToState(msg);
          if (!nextState) return;

          if (msg.type === "session_ended" || msg.type === "session_failed") {
            sessionEndedRef.current = true;
            reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // terminal — do not reconnect
          }
          onStateChange(nextState);
          if (msg.type === "reconnected") onReconnected?.();
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
      const attempt = reconnectAttemptsRef.current;
      const decision = closeDecision(sessionEndedRef.current, attempt, RECONNECT_DELAYS.length);
      if (decision === "ignore") return; // clean/deliberate end — the end handler already set the state
      if (decision === "reconnect") {
        onStateChange("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAYS[attempt]);
      } else {
        // Ran out of reconnect attempts with no clean end — a connection failure, not success.
        // On reload, candidate_info reports the true status (a pre-first-turn drop was reset to
        // pending and can restart; a mid-interview drop shows as failed).
        onStateChange("failed_terminal");
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
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    // A deliberate end (End Interview button or timer expiry). Mark the socket as cleanly ended so
    // onclose does NOT misread it as an exhausted reconnect and flip the screen to "failed_terminal".
    sessionEndedRef.current = true;
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
