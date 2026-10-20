import { useRef, useCallback } from "react";

const PLAYBACK_SAMPLE_RATE = 24000; // Gemini outputs 24kHz

export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const onDrainedRef = useRef<(() => void) | null>(null);
  const drainCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
      audioCtxRef.current = ctx;

      // Attach AnalyserNode to measure live AI voice audio volume
      if (typeof ctx.createAnalyser === "function") {
        try {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;
        } catch {
          // AnalyserNode unsupported or mocked in test environment
        }
      }

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

    if (analyserRef.current) {
      source.connect(analyserRef.current);
    } else {
      source.connect(ctx.destination);
    }

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const getVolume = useCallback((): number => {
    if (!analyserRef.current || !audioCtxRef.current) return 0;
    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      return Math.min(1, Math.max(0, avg / 128));
    } catch {
      return 0;
    }
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
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, [cancelDrain]);

  return { playChunk, stop, scheduleAfterPlayback, waitForDrain, cancelDrain, getVolume };
}
