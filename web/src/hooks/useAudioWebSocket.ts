import { useRef, useState, useCallback, useEffect } from "react";
import { WS_URL } from "@/services/api";
import type { WsControlMessage, TranscriptTurn, InterviewState, InterviewSpeaker } from "@/types";
import {
  enqueueAudioChunk,
  getQueuedAudioChunks,
  deleteAudioChunk,
  clearAudioChunks,
  type QueuedAudioChunk,
} from "@/lib/audioChunkQueue";

interface UseAudioWebSocketOptions {
  sessionId: number;
  token?: string;
  onAudioChunk: (buffer: ArrayBuffer) => void;
  onTranscript: (turn: Pick<TranscriptTurn, "speaker" | "text">) => void;
  onStateChange: (state: InterviewState) => void;
  onSpeakerChange: (speaker: InterviewSpeaker) => void;
  onReconnected?: () => void;
  onFatalError?: (message: string) => void;
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
  onFatalError,
}: UseAudioWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(false);
  const sequenceRef = useRef(0);
  const flushingRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  const flushQueuedChunks = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      let chunks: QueuedAudioChunk[] = await getQueuedAudioChunks(sessionId);
      while (chunks.length > 0) {
        for (const chunk of chunks) {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          wsRef.current.send(chunk.data);
          await deleteAudioChunk(chunk.id);
        }
        chunks = await getQueuedAudioChunks(sessionId);
      }
    } finally {
      flushingRef.current = false;
    }
  }, [sessionId]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    sessionEndedRef.current = false;
    setConnectionState("connecting");
    const url = `${WS_URL}/ws/sessions/${sessionId}/audio`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
      flushQueuedChunks();
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
                onTranscript({
                  speaker: msg.speaker === "candidate" ? "candidate" : "assessor",
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
              onStateChange("active");
              onReconnected?.();
              break;
            case "session_ended":
              sessionEndedRef.current = true;
              reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // suppress reconnect
              onStateChange("complete");
              clearAudioChunks(sessionId);
              break;
            case "error":
              if (!msg.recoverable) {
                sessionEndedRef.current = true;
                reconnectAttemptsRef.current = RECONNECT_DELAYS.length;
                onFatalError?.(msg.message ?? "The interview encountered an error.");
                onStateChange("complete");
                clearAudioChunks(sessionId);
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
        onStateChange("complete");
      }
    };
  }, [
    sessionId,
    token,
    onAudioChunk,
    onTranscript,
    onStateChange,
    onSpeakerChange,
    onFatalError,
    flushQueuedChunks,
  ]);

  const send = useCallback(
    (buffer: ArrayBuffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !flushingRef.current) {
        wsRef.current.send(buffer);
        return;
      }
      sequenceRef.current += 1;
      enqueueAudioChunk({
        sessionId,
        sequence: sequenceRef.current,
        timestamp: Date.now(),
        data: buffer,
      }).then(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          flushQueuedChunks();
        }
      });
    },
    [sessionId, flushQueuedChunks],
  );

  const sendJson = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // prevent reconnect
    wsRef.current?.close();
    clearAudioChunks(sessionId);
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, send, sendJson, disconnect, connectionState };
}
