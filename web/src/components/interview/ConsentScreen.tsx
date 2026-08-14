import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import type { ConsentPolicyContent } from "@/types";

interface ConsentScreenProps {
  roleTitle: string;
  policy: ConsentPolicyContent;
  policyVersion: string;
  submitting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
            <span className="text-primary shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold">You've chosen not to continue</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This interview requires your consent to process your voice recording,
          transcript, and assessment data. Without it, the interview cannot begin.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you have questions or wish to change your mind, contact the company
          that invited you, or return here to start over.
        </p>
        <Button variant="outline" onClick={() => setShowDecline(false)}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Before you start</h1>
          <p className="text-sm text-muted-foreground">
            {roleTitle} · Data protection notice (v{policyVersion})
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-5 max-h-[45vh] overflow-y-auto">
            <Section title="What we collect" items={policy.data_collected} />
            <Section title="Why we use it" items={policy.purposes} />

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">How long we keep it</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{policy.retention}</p>
            </div>

            <Section title="Your rights" items={policy.rights} />

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">Questions?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{policy.contact}</p>
            </div>
          </CardContent>
        </Card>

        <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-accent/40 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm text-foreground leading-relaxed">
            I consent to my voice recording, transcript, and assessment data being
            collected and processed as described above.
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" size="lg" disabled={!agreed || submitting} onClick={onAccept}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start Interview
          </Button>
          <Button
            variant="outline"
            size="lg"
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
