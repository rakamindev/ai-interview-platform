import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIVACY_NOTICE } from "@/content/privacyNotice";
import { Clock3, FileCheck2, Loader2, Mic2, ShieldCheck } from "lucide-react";
import type { ConsentState } from "@/types";

interface ConsentGateProps {
  roleTitle: string;
  timeLimitMin: number;
  consent: ConsentState;
  busy: boolean;
  errorMessage?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentGate({
  roleTitle,
  timeLimitMin,
  consent,
  busy,
  errorMessage,
  onAccept,
  onDecline,
}: ConsentGateProps) {
  if (consent.declined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-10 sm:px-6">
        <Card className="w-full rounded-3xl border-secondary/40 shadow-lg">
          <CardContent className="p-6 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary/25 text-secondary-foreground">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">You cannot continue without consent.</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Your decision has been recorded and the interview has not started. Nothing was recorded.</p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">To withdraw your consent or ask questions about your data, contact the hiring team with your invite link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-start px-4 py-8 sm:px-6 sm:py-12">
      <Card className="w-full overflow-hidden rounded-3xl border-primary/15 shadow-lg">
        <div className="h-2 bg-primary" />
        <CardHeader className="border-b border-border/70 p-6 sm:p-8">
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Privacy &amp; consent</Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Before you start</h1>
          <CardDescription className="text-sm leading-6">{roleTitle} · {timeLimitMin} minutes · voice interview</CardDescription>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Duration</p><p className="font-medium">{timeLimitMin} minutes</p></div>
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3"><Mic2 className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Format</p><p className="font-medium">Voice interview</p></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="leading-6 text-muted-foreground">Please read how your interview data is handled. You must agree before the interview can begin.</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background p-5" tabIndex={0}>
            <div className="space-y-5">
              {PRIVACY_NOTICE.map((section) => (
                <section key={section.heading} className="space-y-2">
                  <h2 className="text-sm font-semibold">{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph} className="text-sm leading-6 text-muted-foreground">{paragraph}</p>)}
                  {section.bullets && <ul className="space-y-2">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-2 text-sm leading-6 text-muted-foreground"><span aria-hidden="true" className="text-primary">•</span><span>{bullet}</span></li>)}</ul>}
                </section>
              ))}
            </div>
          </div>
          {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        </CardContent>
        <CardFooter className="flex-col gap-2 border-t border-border/70 bg-muted/20 p-6 sm:p-8">
          <Button className="min-h-11 w-full" onClick={onAccept} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}I agree and continue</Button>
          <Button variant="outline" className="min-h-11 w-full text-destructive" onClick={onDecline} disabled={busy}>I do not agree</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
