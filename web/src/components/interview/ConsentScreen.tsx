import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ScrollText, ShieldCheck } from "lucide-react";

interface ConsentScreenProps {
  consentText: string;
  consentVersion: string;
  onAccept: (version: string) => void;
  onRevoke: () => void;
  accepting: boolean;
  error?: string | null;
}

export default function ConsentScreen({
  consentText,
  consentVersion,
  onAccept,
  onRevoke,
  accepting,
  error,
}: ConsentScreenProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Data consent
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ScrollText className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Please read this notice before we begin. You can withdraw your consent at any time
            before the interview starts — your data will not be processed.
          </span>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
          {consentText}
        </div>

        <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            I have read and understood this notice, and I consent to the processing of my data as
            described for this interview.
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button
          className="w-full sm:flex-1"
          onClick={() => onAccept(consentVersion)}
          disabled={!acknowledged || accepting}
        >
          {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          I consent — continue
        </Button>
        <Button
          variant="outline"
          className="w-full sm:flex-1"
          onClick={onRevoke}
          disabled={accepting}
        >
          Withdraw consent
        </Button>
      </CardFooter>
    </Card>
  );
}