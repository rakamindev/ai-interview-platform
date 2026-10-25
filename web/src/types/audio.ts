export interface VerifiedMicrophone {
  stream: MediaStream;
  deviceId?: string;
  label?: string;
}

export type AudioCaptureSource = "verified" | "fresh" | "fallback" | "cancelled";

export interface AudioCaptureStartResult {
  source: AudioCaptureSource;
  deviceId?: string;
  label?: string;
  deviceChanged: boolean;
}
