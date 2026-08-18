import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export type AbortedReason = "invalid_invite" | "load_failed" | "session_error";

interface InterviewAbortedProps {
  reason: AbortedReason;
  onRetry: () => void;
}

const MESSAGES: Record<AbortedReason, { title: string; description: string }> = {
  invalid_invite: {
    title: "Invite link not found",
    description:
      "This interview link is invalid or has expired. Check the link or contact the person who invited you.",
  },
  load_failed: {
    title: "Couldn't load your interview",
    description: "We couldn't reach the server to start this interview. Check your connection and retry.",
  },
  session_error: {
    title: "Interview interrupted",
    description:
      "The interview stopped unexpectedly. You can try resuming, or contact the interviewer if this keeps happening.",
  },
};

export default function InterviewAborted({ reason, onRetry }: InterviewAbortedProps) {
  const { title, description } = MESSAGES[reason];

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
      <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}
