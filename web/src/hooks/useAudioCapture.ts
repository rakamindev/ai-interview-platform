import { useRef, useState, useCallback } from "react";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mutedRef = useRef(false);

  const startMonitoringLevel = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize);
    const update = () => {
      if (mutedRef.current) {
        setAudioLevel(0);
      } else {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        setAudioLevel(Math.min(100, Math.round(rms * 400)));
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const start = useCallback(async (deviceId?: string) => {
    if (isCapturing) return;

    try {
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
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
      sourceNodeRef.current = source;
      source.connect(workletNode);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;
      source.connect(analyser);

      startMonitoringLevel(analyser);

      setIsCapturing(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
    }
  }, [isCapturing, onFrame, onError]);

  const switchDevice = useCallback(async (deviceId: string) => {
    if (!audioCtxRef.current || !workletNodeRef.current) return;
    try {
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume().catch(() => {});
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      sourceNodeRef.current?.disconnect();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          deviceId: { exact: deviceId },
        },
      });
      streamRef.current = stream;

      const newSource = audioCtxRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = newSource;
      newSource.connect(workletNodeRef.current);
      if (analyserRef.current) {
        newSource.connect(analyserRef.current);
      }
    } catch (err) {
      console.error("[AudioCapture] Failed to switch device:", err);
    }
  }, []);

  const sendSilence = useCallback((frameCount = 12) => {
    for (let i = 0; i < frameCount; i++) {
      const silentBuffer = new ArrayBuffer(512 * 2);
      onFrame(silentBuffer);
    }
  }, [onFrame]);

  const mute = useCallback(() => {
    mutedRef.current = true;
    setAudioLevel(0);
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
  }, []);

  const stop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current = null;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    setAudioLevel(0);
    setIsCapturing(false);
  }, []);

  return { start, stop, mute, unmute, switchDevice, sendSilence, isCapturing, audioLevel };
}
