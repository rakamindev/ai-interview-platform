import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasInputAudio, setHasInputAudio] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);
  const startVersionRef = useRef(0);
  const inputActiveRef = useRef(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInputActivity = useCallback(() => {
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = null;
    if (inputActiveRef.current) {
      inputActiveRef.current = false;
      setHasInputAudio(false);
    }
  }, []);

  const stop = useCallback(() => {
    clearInputActivity();
    startVersionRef.current += 1;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    setIsCapturing(false);
  }, [clearInputActivity]);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (isCapturing) return true;
    const version = ++startVersionRef.current;

    try {
      // Create/resume in the Start click, before microphone permission can yield.
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const resumed = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (version !== startVersionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;
      await resumed;

      await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
      if (version !== startVersionRef.current) return false;

      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (!mutedRef.current) {
          // This meter reports sound energy, not a claim that the candidate is speaking.
          const samples = new Int16Array(e.data);
          let energy = 0;
          for (const sample of samples) energy += sample * sample;
          if (samples.length && Math.sqrt(energy / samples.length) / 32768 >= 0.01) {
            if (!inputActiveRef.current) {
              inputActiveRef.current = true;
              setHasInputAudio(true);
            }
            if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
            activityTimerRef.current = setTimeout(clearInputActivity, 250);
          }
          onFrame(e.data);
        }
      };
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);
      // The processor writes no speaker samples; this keeps the graph rendering without mic echo.
      workletNode.connect(ctx.destination);

      setIsCapturing(true);
      return true;
    } catch (err) {
      if (version !== startVersionRef.current) return false;
      stop();
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
      return false;
    }
  }, [isCapturing, onFrame, onError, stop, clearInputActivity]);

  const mute = useCallback(() => {
    mutedRef.current = true;
    clearInputActivity();
  }, [clearInputActivity]);

  const unmute = useCallback(() => {
    mutedRef.current = false;
  }, []);

  return { start, stop, mute, unmute, isCapturing, hasInputAudio };
}
