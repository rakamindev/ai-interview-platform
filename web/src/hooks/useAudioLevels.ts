import { useEffect, useRef, useState } from "react";

const ZERO_LEVELS = (barCount: number) => new Array(barCount).fill(0);

// Polls an AnalyserNode via rAF and buckets its frequency data into `barCount`
// normalized (0-1) levels, for driving real-time audio visualizers.
export function useAudioLevels(
  analyser: AnalyserNode | null,
  active: boolean,
  barCount = 5
): number[] {
  const [levels, setLevels] = useState<number[]>(() => ZERO_LEVELS(barCount));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !analyser) {
      setLevels(ZERO_LEVELS(barCount));
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const bucketSize = Math.max(1, Math.floor(data.length / barCount));

    const tick = () => {
      analyser.getByteFrequencyData(data);

      const next = new Array(barCount).fill(0);
      for (let i = 0; i < barCount; i++) {
        const start = i * bucketSize;
        const end = i === barCount - 1 ? data.length : start + bucketSize;
        let sum = 0;
        for (let j = start; j < end; j++) sum += data[j];
        next[i] = sum / (end - start) / 255;
      }

      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [analyser, active, barCount]);

  return levels;
}
