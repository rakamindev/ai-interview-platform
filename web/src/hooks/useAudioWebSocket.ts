import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import { RECONNECT_DELAYS } from "@/utils/constants";
import type { WsControlMessage, TranscriptTurn, InterviewState, InterviewSpeaker } from "@/types";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onTranscriptPartial?: (partial: { speaker: "candidate" | "ai"; text: string }) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
}

export function useAudioWebSocket({
  sessionId,
  token,
  onAudioChunk,
  onTranscript,
  onTranscriptPartial,
  onStateChange,
  onSpeakerChange,
  onReconnected
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected" | "reconnecting" | "unauthenticated"
  >("disconnected");
  const onOpenRef = useRef<(() => void) | null>(null);
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);
  const onErrorRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef<(() => void) | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (!token) {
      setConnectionState("unauthenticated");
      return;
    }

    sessionEndedRef.current = false;
    setConnectionState("connecting");
    const url = `${WS_URL}/ws/sessions/${sessionId}/audio?token=${token}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const handleOpen = () => {
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: "auth", token }));
    };
    onOpenRef.current = handleOpen;
    ws.addEventListener("open", handleOpen);

    // Only signal AI speaking once per turn (first binary chunk).
    // Reset when speaker_changed:candidate arrives.
    let aiSpeakingSignalled = false;

    const handleMessage = (event: MessageEvent) => {
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
                onTranscript({
                  speaker: msg.speaker === "candidate" ? "candidate" : "assessor",
                  text: msg.text
                });
              }
              break;
            case "transcript_partial":
              if (msg.speaker && msg.text)
                onTranscriptPartial?.({ speaker: msg.speaker, text: msg.text });
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
              if (!msg.recoverable) onStateChange("complete");
              break;
          }
        } catch {
          // Non-JSON text frame — ignore
        }
      }
    };
    onMessageRef.current = handleMessage;
    ws.addEventListener("message", handleMessage);

    const handleError = () => {
      setConnectionState("disconnected");
    };
    onErrorRef.current = handleError;
    ws.addEventListener("error", handleError);

    const handleClose = () => {
      if (sessionEndedRef.current) {
        setConnectionState("disconnected");
        return; // session ended cleanly — do not reconnect
      }
      const attempt = reconnectAttemptsRef.current;
      if (attempt < RECONNECT_DELAYS.length) {
        setConnectionState("reconnecting");
        onStateChange("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connectRef.current();
        }, RECONNECT_DELAYS[attempt]);
      } else {
        setConnectionState("disconnected");
        onStateChange("complete");
      }
    };
    onCloseRef.current = handleClose;
    ws.addEventListener("close", handleClose);
  }, [
    sessionId,
    token,
    onAudioChunk,
    onTranscript,
    onTranscriptPartial,
    onStateChange,
    onSpeakerChange,
    onReconnected
  ]);

  // Keep connectRef in sync outside the callback to avoid self-reference in deps
  connectRef.current = connect;

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
      const ws = wsRef.current;
      if (ws) {
        if (onOpenRef.current) ws.removeEventListener("open", onOpenRef.current);
        if (onMessageRef.current) ws.removeEventListener("message", onMessageRef.current);
        if (onErrorRef.current) ws.removeEventListener("error", onErrorRef.current);
        if (onCloseRef.current) ws.removeEventListener("close", onCloseRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  return { connect, send, sendJson, disconnect, connectionState };
}
