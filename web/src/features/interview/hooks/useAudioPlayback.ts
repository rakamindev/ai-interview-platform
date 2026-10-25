import { useRef, useCallback } from "react";

const PLAYBACK_SAMPLE_RATE = 24000; // Gemini outputs 24kHz

export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const onDrainedRef = useRef<(() => void) | null>(null);
  const drainCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
      nextPlayTimeRef.current = 0;
    }
    return audioCtxRef.current;
  };

  const playChunk = useCallback(async (raw: ArrayBuffer) => {
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();

    // Raw PCM is Int16 from Gemini
    const int16 = new Int16Array(raw);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  // Registers a one-shot callback that fires when the audio queue drains.
  // Polls every 250ms until nextPlayTime has passed, then calls the callback.
  const waitForDrain = useCallback((fn: () => void) => {
    const ctx = audioCtxRef.current;
    // Resolve immediately if queue is already empty
    if (!ctx || ctx.currentTime >= nextPlayTimeRef.current) {
      fn();
      return;
    }
    onDrainedRef.current = fn;
    if (drainCheckRef.current) clearInterval(drainCheckRef.current);
    drainCheckRef.current = setInterval(() => {
      const c = audioCtxRef.current;
      if (!c || c.currentTime >= nextPlayTimeRef.current) {
        if (drainCheckRef.current) clearInterval(drainCheckRef.current);
        drainCheckRef.current = null;
        const cb = onDrainedRef.current;
        onDrainedRef.current = null;
        cb?.();
      }
    }, 250);
  }, []);

  const cancelDrain = useCallback(() => {
    if (drainCheckRef.current) clearInterval(drainCheckRef.current);
    drainCheckRef.current = null;
    onDrainedRef.current = null;
  }, []);

  const scheduleAfterPlayback = useCallback((fn: () => void) => {
    const ctx = audioCtxRef.current;
    if (!ctx) { fn(); return; }
    const remaining = (nextPlayTimeRef.current - ctx.currentTime) * 1000;
    if (remaining <= 0) { fn(); return; }
    setTimeout(fn, remaining);
  }, []);

  const stop = useCallback(() => {
    cancelDrain();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, [cancelDrain]);

  return { playChunk, stop, scheduleAfterPlayback, waitForDrain, cancelDrain };
}
