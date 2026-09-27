import { useRef, useState, useCallback } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const visualizerGainRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);

  const start = useCallback(async () => {
    if (isCapturing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
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
        if (!mutedRef.current) {
          onFrame(e.data);
        }
      };
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);

      // Dedicated visualizer branch gated by GainNode (ADR 0010 & ADR 0006)
      const visualizerGain = ctx.createGain();
      visualizerGain.gain.setValueAtTime(mutedRef.current ? 0 : 1, ctx.currentTime);
      visualizerGainRef.current = visualizerGain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserNodeRef.current = analyser;
      source.connect(visualizerGain);
      visualizerGain.connect(analyser);

      setAnalyserNode(analyser);
      setIsCapturing(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
    }
  }, [isCapturing, onFrame, onError]);

  const mute = useCallback(() => {
    mutedRef.current = true;
    if (visualizerGainRef.current && audioCtxRef.current) {
      visualizerGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
    }
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    if (visualizerGainRef.current && audioCtxRef.current) {
      visualizerGainRef.current.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
    }
  }, []);

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    visualizerGainRef.current?.disconnect();
    visualizerGainRef.current = null;
    analyserNodeRef.current?.disconnect();
    analyserNodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    setAnalyserNode(null);
    setIsCapturing(false);
  }, []);

  return { start, stop, mute, unmute, isCapturing, analyserNode };
}

