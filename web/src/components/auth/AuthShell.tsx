import type { ReactNode } from "react";
import { BrainCircuit, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Rakamin AI Interview</p>
            <p className="text-xs text-slate-400">Evidence-first talent assessment</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-secondary" />
            Human-in-the-loop decision support
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Turn interview evidence into decisions you can defend.
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-300">
              Structure interview evidence, surface uncertainty, and compare role expectations without hiding the human judgment behind the process.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" />Evidence-linked skill summaries</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-primary" />Unknown evidence is never treated as a negative signal</div>
            <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" />Assessor overrides remain visible and auditable</div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          Product Engineer case study · redesigned for clarity, trust, and resilient workflows
        </p>
      </section>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
