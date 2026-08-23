import { CheckCircle, CircleAlert, ClipboardCheck, UsersRound } from "lucide-react";

interface CompletionCopy {
  heading: string;
  summary: string;
  technicalIssue: boolean;
}

export function completionCopy(endReason?: string): CompletionCopy {
  switch (endReason) {
    case "manual_candidate":
      return {
        heading: "Interview ended",
        summary: "You chose to end the interview. The responses recorded before it ended have been saved for review.",
        technicalIssue: false,
      };
    case "time_ceiling":
      return {
        heading: "Interview time is complete",
        summary: "The interview reached its time limit. Your recorded responses have been saved for review.",
        technicalIssue: false,
      };
    case "error":
      return {
        heading: "Interview ended due to a technical problem",
        summary: "We could not confirm a clean interview completion. Please contact the hiring team so they can confirm the next step.",
        technicalIssue: true,
      };
    case "all_covered":
    case "manual_assessor":
      return {
        heading: "Interview complete",
        summary: "Your recorded responses have been saved and the assessment record is being prepared for review.",
        technicalIssue: false,
      };
    default:
      return {
        heading: "Interview session ended",
        summary: "Your session has ended. The hiring team can confirm any next steps.",
        technicalIssue: false,
      };
  }
}

export default function InterviewCompletionFeedback({
  roleTitle,
  endReason,
}: {
  roleTitle?: string;
  endReason?: string;
}) {
  const copy = completionCopy(endReason);

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-6">
      <header className="text-center space-y-3">
        {copy.technicalIssue ? (
          <CircleAlert className="h-11 w-11 mx-auto text-amber-600" aria-hidden="true" />
        ) : (
          <CheckCircle className="h-11 w-11 mx-auto text-green-600" aria-hidden="true" />
        )}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{copy.heading}</h2>
          {roleTitle && <p className="text-sm text-muted-foreground">{roleTitle}</p>}
        </div>
        <p className="text-sm text-muted-foreground">{copy.summary}</p>
      </header>

      {copy.technicalIssue ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-1">
          <h3 className="font-medium">What to do next</h3>
          <p>Keep your invitation details available and contact the hiring team. They can confirm whether your recorded responses are sufficient or whether another interview is needed.</p>
        </section>
      ) : (
        <section aria-labelledby="next-steps-heading" className="rounded-lg border bg-card p-4 space-y-3">
          <h3 id="next-steps-heading" className="text-sm font-semibold">What happens next</h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <ClipboardCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>We are preparing your interview record for the hiring team.</span>
            </li>
            <li className="flex gap-3">
              <UsersRound className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>The hiring team will review the assessment and communicate any next steps through their usual process.</span>
            </li>
          </ol>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">No further action is needed on this page. You may close it now.</p>
    </div>
  );
}
