import { cn } from "@/lib/utils";

interface BrandMarkProps {
  // Hides the wordmark on narrow screens where the header has no room for it.
  compact?: boolean;
  className?: string;
}

// Rakamin "</" mark, traced from the Rakamin Academy app icon: a teal chevron and slash with a yellow cap.
function RakaminMark({ className }: { className?: string }) {
  return (
    <svg viewBox="16 16 148 148" aria-hidden="true" className={className}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-rakamin-teal">
        <path d="M76 52 36 92l40 40" strokeWidth="32" />
        <path d="M140.5 58 117.5 132.5" strokeWidth="31" />
      </g>
      <path
        d="M126.4 50.9 131.8 33.3 149.9 38.9A12 12 0 0 1 157.9 53.9L153 70Z"
        className="fill-rakamin-yellow"
      />
    </svg>
  );
}

export default function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <RakaminMark className="h-8 w-8 shrink-0" />
      <span className={cn("text-sm font-semibold tracking-tight", compact && "hidden md:inline")}>
        Rakamin <span className="text-primary">AI Interview</span>
      </span>
    </span>
  );
}
