import { useRef, useCallback } from "react";

const CAPTURE_INTERVAL_MS = 3 * 60_000;

interface UseSnapshotCaptureOptions {
  onCapture: (imageBase64: string) => void;
  onError?: (error: Error) => void;
}

export function useSnapshotCapture({ onCapture, onError }: UseSnapshotCaptureOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    onCapture(dataUrl.split(",")[1]);
  }, [onCapture]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
    }
  }, [captureFrame, onError]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    videoRef.current = null;
  }, []);

  return { start, stop };
}
