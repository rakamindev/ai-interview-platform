import { Outlet } from "react-router-dom";
import WaveformSignature from "@/shared/components/WaveformSignature";
import { brand } from "@/shared/theme/colors";

export default function CandidateLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Candidate-facing header — same brand voice as the auth pages
          (font-display wordmark + waveform), no nav since candidates only
          ever see their own interview.
          Fixed h-12: InterviewPage's own sticky bar assumes `top-12` here —
          keep this exact height so the two don't overlap/gap when stacked. */}
      <header className="flex h-12 items-center justify-between px-4 text-white" style={{ backgroundColor: brand.tealDark }}>
        <span className="font-display text-sm font-semibold">AI Interview</span>
        <WaveformSignature barCount={12} className="h-4" />
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
