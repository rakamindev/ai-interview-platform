import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sessionsApi } from "@/services/sessions";
import { Loader2, ShieldCheck, FileText, Database, Trash2 } from "lucide-react";

interface ConsentScreenProps {
  token: string;
  roleTitle: string;
  timeLimitMin: number;
  version: string;
  onGranted: () => void;
}

function DisclosureRow({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 text-primary">{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground break-words">{children}</p>
      </div>
    </div>
  );
}

export default function ConsentScreen({
  token,
  roleTitle,
  timeLimitMin,
  version,
  onGranted,
}: ConsentScreenProps) {
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    if (granting) return;
    setGranting(true);
    setError(null);
    try {
      await sessionsApi.grantConsent(token, version);
      onGranted();
    } catch {
      setError(
        "We couldn't save your consent. Please check your connection and try again."
      );
    } finally {
      setGranting(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6 space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Before you start</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your consent is required before this {roleTitle} interview can
            begin.
          </p>
        </div>

        <div className="space-y-4">
          <DisclosureRow
            icon={<FileText className="h-4 w-4" />}
            title="What happens"
          >
            An AI interviewer will ask you questions in a live voice
            conversation for up to {timeLimitMin} minutes. Your microphone is
            active only while you speak.
          </DisclosureRow>

          <DisclosureRow
            icon={<Database className="h-4 w-4" />}
            title="What we collect"
          >
            A text transcript of the conversation, plus basic technical checks
            (browser, OS, connection speed). The transcript is shared with our
            AI provider to generate the interview.
          </DisclosureRow>

          <DisclosureRow
            icon={<Trash2 className="h-4 w-4" />}
            title="Your data rights"
          >
            Your interview data is retained for 30 days, then deleted. You can
            view your transcript and request deletion at any time from the "Your
            data" page after the interview.
          </DisclosureRow>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAgree}
            disabled={granting}
          >
            {granting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving your
                consent...
              </>
            ) : (
              "I Agree & Continue"
            )}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Disclosure version {version}. You can review this at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
