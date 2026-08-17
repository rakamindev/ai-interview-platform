import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, HelpCircle, Lightbulb } from "lucide-react";

interface PrepHubProps {
  roleTitle: string;
  timeLimitMin: number;
  skillAreas: string[];
}

const PRACTICE_QUESTIONS = [
  "Walk me through a recent project you're proud of — what was your role?",
  "Tell me about a time you disagreed with a teammate. How did you handle it?",
];

export default function PrepHub({ roleTitle, timeLimitMin, skillAreas }: PrepHubProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-teal-600" /> Prep hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1.5 text-muted-foreground">
          <p>• This is a voice interview for <strong>{roleTitle}</strong> — up to {timeLimitMin} minutes.</p>
          <p>• The AI asks follow-up questions based on your answers. There are no scripts.</p>
          <p>• Find a quiet place, keep your mic on, and answer as naturally as you would in person.</p>
          <p>• You can end the interview at any time.</p>
        </div>

        {skillAreas.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Areas we may explore
            </p>
            <div className="flex flex-wrap gap-2">
              {skillAreas.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => setOpen((v) => !v)}>
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Practice (not scored)
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
          {open && (
            <div className="mt-3 space-y-2">
              {PRACTICE_QUESTIONS.map((q, i) => (
                <div key={q} className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Sample question {i + 1}</p>
                  <p>{q}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                These are for practice only — your answers here are not recorded or scored.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}