import { useRef, useState, useCallback } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onSpeechEnd, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [hasSpoken, setHasSpoken] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);

  const speechFramesRef = useRef(0);
  const lastLevelUpdateRef = useRef(0);
  const levelDecayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFrameRef = useRef(onFrame);
  const onSpeechEndRef = useRef(onSpeechEnd);
  onFrameRef.current = onFrame;
  onSpeechEndRef.current = onSpeechEnd;

  const clearTimers = useCallback(() => {
    if (levelDecayTimerRef.current) {
      clearTimeout(levelDecayTimerRef.current);
      levelDecayTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetTurnSpeech = useCallback(() => {
    speechFramesRef.current = 0;
    setHasSpoken(false);
    setMicLevel(0);
    clearTimers();
  }, [clearTimers]);

  const start = useCallback(async () => {
    if (isCapturing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (mutedRef.current) return;

        onFrameRef.current(e.data);

        // Compute Int16 RMS to drive live voice feedback and end-of-speech detection
        const pcm16 = new Int16Array(e.data);
        if (pcm16.length === 0) return;

        let sumSq = 0;
        for (let i = 0; i < pcm16.length; i++) {
          sumSq += pcm16[i] * pcm16[i];
        }
        const rms = Math.sqrt(sumSq / pcm16.length);
        const normalizedLevel = Math.min(100, Math.round((rms / 3200) * 100));

        const now = performance.now();
        if (now - lastLevelUpdateRef.current >= 55) {
          lastLevelUpdateRef.current = now;
          setMicLevel(normalizedLevel);
        }

        if (levelDecayTimerRef.current) clearTimeout(levelDecayTimerRef.current);
        levelDecayTimerRef.current = setTimeout(() => {
          setMicLevel(0);
        }, 150);

        if (rms >= 160) {
          speechFramesRef.current += 1;
          if (speechFramesRef.current >= 12) {
            setHasSpoken(true);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (!mutedRef.current && speechFramesRef.current >= 12) {
                speechFramesRef.current = 0;
                onSpeechEndRef.current?.();
              }
            }, 1750);
          }
        }
      };
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);

      setIsCapturing(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
    }
  }, [isCapturing, onError]);

  const mute = useCallback(() => {
    mutedRef.current = true;
    setMicLevel(0);
    clearTimers();
  }, [clearTimers]);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    speechFramesRef.current = 0;
    setHasSpoken(false);
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    speechFramesRef.current = 0;
    setHasSpoken(false);
    setMicLevel(0);
    setIsCapturing(false);
  }, [clearTimers]);

  return {
    start,
    stop,
    mute,
    unmute,
    resetTurnSpeech,
    isCapturing,
    micLevel,
    isSpeaking: micLevel >= 6,
    hasSpoken,
  };
}
