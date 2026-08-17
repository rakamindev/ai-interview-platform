import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function VoiceBarsMark({ onTeal = false, className }: { onTeal?: boolean; className?: string }) {
  // Fifth bar stays yellow: the two voices of a session — teal AI interviewer, yellow candidate.
  return (
    <div aria-hidden="true" className={cn("flex h-10 items-end gap-1.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 rounded-full animate-voice-bar",
            onTeal ? "bg-white" : "bg-primary",
            i === 4 && "bg-secondary",
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.6 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:p-12">
        <div>
          <div className="flex items-center gap-3">
            <VoiceBarsMark onTeal />
            <span className="text-4xl font-bold tracking-tight">AI Interview</span>
          </div>
          <p className="mt-10 max-w-sm text-2xl font-semibold leading-snug">
            Live AI voice interviews, scored on evidence.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <VoiceBarsMark />
            <span className="text-3xl font-bold tracking-tight">AI Interview</span>
          </div>

          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
