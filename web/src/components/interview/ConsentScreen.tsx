import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileText, Info, ListChecks, Loader2, Mail } from "lucide-react";
import type { ConsentPolicyContent } from "@/types";

interface ConsentScreenProps {
  roleTitle: string;
  policy: ConsentPolicyContent;
  policyVersion: string;
  submitting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function Group({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <ul className="space-y-1.5 pl-6">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextGroup({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <p className="pl-6 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ConsentScreen({
  roleTitle,
  policy,
  policyVersion,
  submitting,
  onAccept,
  onDecline,
}: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  if (showDecline) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">You've chosen not to continue</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            This interview requires your consent to process your voice recording,
            transcript, and assessment data. Without it, the interview cannot begin.
          </p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            If you have questions or wish to change your mind, contact the company
            that invited you, or return here to start over.
          </p>
          <Button variant="outline" onClick={() => setShowDecline(false)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Before you start</h1>
          <p className="text-sm text-muted-foreground">
            {roleTitle} · Data protection notice{" "}
            <span className="font-mono text-xs tabular-nums">v{policyVersion}</span>
          </p>
        </div>

        {/* The disclosure scrolls with the page so the actions below stay reachable. */}
        <Card>
          <CardContent className="space-y-5 p-5">
            <Group
              icon={<FileText className="h-4 w-4" />}
              title="What we collect"
              items={policy.data_collected}
            />
            <Group
              icon={<Info className="h-4 w-4" />}
              title="Why we use it"
              items={policy.purposes}
            />
            <TextGroup
              icon={<Clock className="h-4 w-4" />}
              title="How long we keep it"
              text={policy.retention}
            />
            <Group
              icon={<ListChecks className="h-4 w-4" />}
              title="Your rights"
              items={policy.rights}
            />
            <TextGroup
              icon={<Mail className="h-4 w-4" />}
              title="Who to contact"
              text={policy.contact}
            />
          </CardContent>
        </Card>

        <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm leading-relaxed text-foreground">
            I consent to my voice recording, transcript, and assessment data being
            collected and processed as described above.
          </span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" size="lg" disabled={!agreed || submitting} onClick={onAccept}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start Interview
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={submitting}
            onClick={() => {
              onDecline();
              setShowDecline(true);
            }}
          >
            I don't consent
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can withdraw your consent at any time by contacting the company that invited you.
        </p>
      </div>
    </div>
  );
}
