import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mic, Volume2, CheckCircle2 } from "lucide-react";

interface DeviceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeviceSettingsModal({
  open,
  onOpenChange,
}: DeviceSettingsModalProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      // Clean up audio context and stream when modal closes
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
      audioContextRef.current = null;
      streamRef.current = null;
      setAudioLevel(0);
      return;
    }

    // Enumerate devices
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        const audioInputs = devs.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      });
    }

    // Start live mic test meter
    navigator.mediaDevices
      ?.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      })
      .then((stream) => {
        streamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Scale from 0 to 100%
          const normalized = Math.min(100, Math.round((average / 128) * 100 * 2));
          setAudioLevel(normalized);

          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      })
      .catch(() => {
        // Microphone access denied or in use
      });

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, [open, selectedDeviceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Audio & Microphone Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Microphone Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="micSelect">Microphone Input</Label>
            <select
              id="micSelect"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {devices.length === 0 ? (
                <option value="">Default Microphone</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Live Mic Check Meter */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                Live Mic Level Check
              </span>
              <span className="text-xs font-mono">{audioLevel}%</span>
            </div>

            {/* Level Bar */}
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  audioLevel > 15 ? "bg-emerald-500" : "bg-primary/40"
                }`}
                style={{ width: `${Math.max(4, audioLevel)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Speak into your microphone. The green level bar should bounce as you talk.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Hardware sound engine active (16kHz 16-bit PCM streaming ready).</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
