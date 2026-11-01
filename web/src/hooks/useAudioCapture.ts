import { useRef, useState, useCallback } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    setIsCapturing(false);
  }, []);

  // Resolves true once the mic is live and frames are flowing, false if capture
  // could not be started. Callers that open other resources (e.g. the
  // WebSocket) should wait for this before doing so.
  const start = useCallback(async (): Promise<boolean> => {
    if (isCapturing) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (!mutedRef.current) {
          onFrame(e.data);
        }
      };
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);

      setIsCapturing(true);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      // Don't leave the mic hot if we failed after acquiring it (e.g. the
      // worklet module failed to load).
      stop();
      onError?.(error);
      return false;
    }
  }, [isCapturing, onFrame, onError, stop]);

  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
  }, []);

  return { start, stop, mute, unmute, isCapturing };
}
