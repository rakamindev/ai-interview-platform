import { useRef, useState, useCallback, useEffect } from "react";
import type { AudioCaptureStartResult, VerifiedMicrophone } from "@/types/audio";

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
};

function liveAudioTrack(stream: MediaStream): MediaStreamTrack | undefined {
  return stream.getAudioTracks().find((track) => track.readyState === "live");
}

function trackDetails(track: MediaStreamTrack | undefined) {
  return {
    deviceId: track?.getSettings().deviceId,
    label: track?.label || undefined,
  };
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const endedTrackRef = useRef<MediaStreamTrack | null>(null);
  const endedHandlerRef = useRef<(() => void) | null>(null);
  const stoppedTracksRef = useRef(new WeakSet<MediaStreamTrack>());
  const startPromiseRef = useRef<Promise<AudioCaptureStartResult> | null>(null);
  const currentResultRef = useRef<AudioCaptureStartResult | null>(null);
  const lifecycleRef = useRef(0);
  const mountedRef = useRef(true);
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  // The speaker gate starts closed. Capture may initialize before the backend
  // grants the candidate turn, but no frames can leave during that window.
  const mutedRef = useRef(true);

  onFrameRef.current = onFrame;
  onErrorRef.current = onError;

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      if (stoppedTracksRef.current.has(track)) return;
      stoppedTracksRef.current.add(track);
      track.stop();
    });
  }, []);

  const cleanupResources = useCallback(() => {
    if (endedTrackRef.current && endedHandlerRef.current) {
      endedTrackRef.current.removeEventListener("ended", endedHandlerRef.current);
    }
    endedTrackRef.current = null;
    endedHandlerRef.current = null;

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;

    const context = audioCtxRef.current;
    audioCtxRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }

    const stream = streamRef.current;
    streamRef.current = null;
    stopStream(stream);
    currentResultRef.current = null;
  }, [stopStream]);

  const acquireMicrophone = useCallback(async (preferredDeviceId?: string) => {
    if (preferredDeviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: preferredDeviceId } },
        });
      } catch (error) {
        const name = error && typeof error === "object" && "name" in error
          ? String(error.name)
          : "";
        if (name !== "NotFoundError" && name !== "OverconstrainedError") throw error;
      }
    }

    return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
  }, []);

  const start = useCallback((verified?: VerifiedMicrophone): Promise<AudioCaptureStartResult> => {
    if (currentResultRef.current) return Promise.resolve(currentResultRef.current);
    if (startPromiseRef.current) return startPromiseRef.current;

    const generation = lifecycleRef.current;
    mutedRef.current = true;

    const run = async (): Promise<AudioCaptureStartResult> => {
      let stream = verified?.stream;
      let source: AudioCaptureStartResult["source"] = verified ? "verified" : "fresh";
      const verifiedDeviceId = verified?.deviceId;

      if (!stream || !liveAudioTrack(stream)) {
        if (stream) stopStream(stream);
        stream = await acquireMicrophone(verifiedDeviceId);
        source = verified ? "fallback" : "fresh";
      }

      if (generation !== lifecycleRef.current) {
        stopStream(stream);
        return { source: "cancelled", deviceChanged: false };
      }
      streamRef.current = stream;

      const context = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = context;
      await context.audioWorklet.addModule("/audio-worklet-processor.js");

      if (generation !== lifecycleRef.current) {
        cleanupResources();
        return { source: "cancelled", deviceChanged: false };
      }

      // The verified track can end while the worklet module is loading. Recheck
      // immediately before wiring it into the capture graph.
      let audioTrack = liveAudioTrack(stream);
      if (!audioTrack) {
        stopStream(stream);
        const replacementStream = await acquireMicrophone(verifiedDeviceId);
        if (generation !== lifecycleRef.current) {
          stopStream(replacementStream);
          return { source: "cancelled", deviceChanged: false };
        }
        stream = replacementStream;
        streamRef.current = stream;
        source = verified ? "fallback" : "fresh";
        audioTrack = liveAudioTrack(stream);
      }
      if (!audioTrack) throw new Error("No live microphone track is available");

      const workletNode = new AudioWorkletNode(context, "pcm-processor");
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!mutedRef.current) onFrameRef.current(event.data);
      };
      workletNodeRef.current = workletNode;

      const sourceNode = context.createMediaStreamSource(stream);
      sourceNode.connect(workletNode);
      sourceNodeRef.current = sourceNode;

      const endedHandler = () => {
        if (streamRef.current !== stream) return;
        lifecycleRef.current += 1;
        cleanupResources();
        if (mountedRef.current) setIsCapturing(false);
        onErrorRef.current?.(new Error("The microphone disconnected during the interview"));
      };
      audioTrack.addEventListener("ended", endedHandler, { once: true });
      endedTrackRef.current = audioTrack;
      endedHandlerRef.current = endedHandler;

      const details = trackDetails(audioTrack);
      const result: AudioCaptureStartResult = {
        source,
        ...details,
        deviceChanged: Boolean(
          verifiedDeviceId && details.deviceId && verifiedDeviceId !== details.deviceId
        ),
      };
      currentResultRef.current = result;
      if (mountedRef.current) setIsCapturing(true);
      return result;
    };

    const promise = run()
      .catch((error: unknown) => {
        cleanupResources();
        if (generation !== lifecycleRef.current) {
          return { source: "cancelled" as const, deviceChanged: false };
        }
        const normalized = error instanceof Error ? error : new Error(String(error));
        onErrorRef.current?.(normalized);
        throw normalized;
      })
      .finally(() => {
        if (startPromiseRef.current === promise) startPromiseRef.current = null;
      });

    startPromiseRef.current = promise;
    return promise;
  }, [acquireMicrophone, cleanupResources, stopStream]);

  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
  }, []);

  const stop = useCallback(() => {
    lifecycleRef.current += 1;
    startPromiseRef.current = null;
    mutedRef.current = true;
    cleanupResources();
    if (mountedRef.current) setIsCapturing(false);
  }, [cleanupResources]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      startPromiseRef.current = null;
      mutedRef.current = true;
      cleanupResources();
    };
  }, [cleanupResources]);

  return { start, stop, mute, unmute, isCapturing };
}
