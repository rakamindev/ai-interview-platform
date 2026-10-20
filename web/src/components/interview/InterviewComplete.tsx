import { Check, FileText, MessageSquare, UserCheck } from "lucide-react";

// What happens after the interview, in the order it happens. Each step is something the product does:
// the portfolio quotes the candidate, and an assessor can override any level.
const NEXT_STEPS = [
  {
    icon: FileText,
    title: "A skill summary is drafted",
    body: "The AI drafts a summary of the skills you showed, quoting what you said.",
  },
  {
    icon: UserCheck,
    title: "A person reviews it",
    body: "Someone on the hiring team reads the summary and can correct it.",
  },
  {
    icon: MessageSquare,
    title: "The hiring team follows up",
    body: "They'll contact you about the next step.",
  },
];

interface InterviewCompleteProps {
  roleTitle?: string;
}

export default function InterviewComplete({ roleTitle }: InterviewCompleteProps) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      {/* The same deep teal as the live interview's header, so the end reads as part of the same room. */}
      <section
        aria-labelledby="interview-complete-title"
        className="relative overflow-hidden rounded-2xl bg-[hsl(var(--primary-deep))] px-6 pb-8 pt-10 text-center text-white shadow-lg"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/70 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-secondary/20 blur-2xl" />

        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-secondary/40 motion-safe:animate-ping [animation-iteration-count:2]" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-[hsl(var(--primary-deep))] shadow-md motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
            <Check aria-hidden className="h-8 w-8" strokeWidth={3} />
          </span>
        </div>

        <p className="relative break-words text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          {roleTitle ?? "AI Interview"}
        </p>
        <h2 id="interview-complete-title" className="relative mt-1 text-2xl font-semibold">
          Interview Complete
        </h2>
        <p className="relative mt-2 text-sm text-white/80">Thank you for your time. Your answers have been saved.</p>
      </section>

      <section aria-labelledby="interview-next-title" className="mt-6 rounded-2xl border bg-card p-5 sm:p-6">
        <h3 id="interview-next-title" className="text-sm font-semibold">
          What happens next
        </h3>
        <ol className="mt-4">
          {NEXT_STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative flex gap-3 pb-5 last:pb-0">
              {/* The line joining one step to the next. */}
              {i < NEXT_STEPS.length - 1 && (
                <span aria-hidden className="absolute left-4 top-9 bottom-1 w-px -translate-x-1/2 bg-border" />
              )}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon aria-hidden className="h-4 w-4" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">You can close this tab now.</p>
    </div>
  );
}
