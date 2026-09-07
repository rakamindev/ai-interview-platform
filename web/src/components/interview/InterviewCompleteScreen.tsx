import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { outcomeFromEndReason, type InterviewOutcome } from "@/lib/interviewOutcome";

interface InterviewCompleteScreenProps {
  /** Raw `end_reason` from the backend. Undefined is treated as a failure, not a success. */
  endReason?: string | null;
  /** Optional message the backend attached to `session_ended`. */
  message?: string | null;
}

interface Variant {
  icon: typeof CheckCircle2;
  title: string;
  body: string;
  /** Tailwind tokens for the icon medallion — one visual language per state. */
  tone: string;
  ring: string;
}

const VARIANTS: Record<InterviewOutcome, Variant> = {
  completed: {
    icon: CheckCircle2,
    title: "Interview complete",
    body: "Thank you — your interview was recorded successfully. The hiring team will review your results and follow up with you.",
    tone: "text-success",
    ring: "bg-success-subtle ring-success-subtle",
  },
  timed_out: {
    icon: Clock,
    title: "Time is up",
    body: "The session reached its time limit and has ended. Everything you answered up to this point was recorded, and the hiring team will review it.",
    tone: "text-warning",
    ring: "bg-warning-subtle ring-warning-subtle",
  },
  error: {
    icon: AlertTriangle,
    title: "The interview didn't finish",
    body: "Something went wrong and the session ended before it could be completed. Your results have not been submitted.",
    tone: "text-destructive",
    ring: "bg-danger-subtle ring-danger-subtle",
  },
};

export default function InterviewCompleteScreen({ endReason, message }: InterviewCompleteScreenProps) {
  const outcome = outcomeFromEndReason(endReason);
  const variant = VARIANTS[outcome];
  const Icon = variant.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="interview-complete-screen"
      data-outcome={outcome}
      className="mx-auto w-full max-w-md px-4 py-12 sm:py-16 text-center"
    >
      <div
        className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ring-8 ${variant.ring}`}
      >
        <Icon className={`h-8 w-8 ${variant.tone}`} aria-hidden="true" />
      </div>

      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{variant.title}</h2>

      {/* break-words keeps long backend messages from blowing out the layout on mobile */}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground break-words">{variant.body}</p>

      {outcome === "error" && (
        <div className="mt-6 rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-left">
          <p className="text-sm font-medium">What to do next</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words">
            {message?.trim() ||
              "Please contact your interviewer so they can send you a new invitation link."}
          </p>
        </div>
      )}
    </div>
  );
}
