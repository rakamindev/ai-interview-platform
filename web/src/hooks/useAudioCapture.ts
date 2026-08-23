import { useRef, useState, useCallback } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  // Mirrors mutedRef for UI consumption — mutedRef stays the source of truth
  // read inside the worklet message handler (no re-render on every frame).
  const [isSending, setIsSending] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);

  const start = useCallback(async () => {
    if (isCapturing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
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

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsCapturing(true);
      setIsSending(!mutedRef.current);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // oxlint-disable-next-line eslint/no-console
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
    }
  }, [isCapturing, onFrame, onError]);

  const mute = useCallback(() => {
    mutedRef.current = true;
    setIsSending(false);
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    setIsSending(true);
  }, []);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
    }
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    setIsCapturing(false);
    setIsSending(false);
  }, []);

  return { start, stop, mute, unmute, isCapturing, isSending, analyserRef };
}
