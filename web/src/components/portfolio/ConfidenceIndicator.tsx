import { AlertCircle } from "lucide-react";
import { toConfidenceLabel } from "@/utils/confidence";

interface ConfidenceIndicatorProps {
  /**
   * Longgar secara sengaja: API mengirim `string` tanpa jaminan, dan pada
   * praktiknya field ini bisa hilang dari payload. Tipe yang berbohong
   * ("selalu ada") justru menyembunyikan cabang yang harus kita tangani.
   */
  confidence: string | null | undefined;
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = toConfidenceLabel(confidence);

  if (label === "HIGH") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        Confidence: HIGH
      </span>
    );
  }

  if (label === "MEDIUM") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
        Confidence: MEDIUM
      </span>
    );
  }

  if (label === "LOW") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
        Confidence: LOW
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1 text-xs text-muted-foreground"
      title="Nilai confidence tidak dikirim oleh API atau tidak dikenal. Ini bukan penilaian rendah — datanya memang tidak ada."
    >
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      Confidence: not available
    </span>
  );
}
