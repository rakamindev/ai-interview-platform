import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquareQuote } from "lucide-react";
import type { MatchingCvClaim } from "@/types";

interface CvEvidenceCardProps {
  matchingCvClaims: MatchingCvClaim[];
  interviewEvidence: string[];
}

export default function CvEvidenceCard({
  matchingCvClaims,
  interviewEvidence,
}: CvEvidenceCardProps) {
  if (matchingCvClaims.length === 0 && interviewEvidence.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          CV Claims vs Interview Verification
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* CV Claims Column */}
        <div className="space-y-2 border-r-0 md:border-r md:pr-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Candidate CV Claims
          </div>
          {matchingCvClaims.length > 0 ? (
            <div className="space-y-2">
              {matchingCvClaims.map((claim, idx) => (
                <div key={idx} className="p-2 rounded bg-background border text-xs space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] py-0 uppercase">
                      {claim.section_type}
                    </Badge>
                    {claim.company && (
                      <span className="font-semibold text-foreground text-[11px]">
                        @{claim.company}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {claim.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No matching project claim found in parsed CV.
            </p>
          )}
        </div>

        {/* Interview Verification Column */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MessageSquareQuote className="h-3.5 w-3.5 text-emerald-600 inline-block" />
            Spoken Interview Quotes
          </div>
          {interviewEvidence.length > 0 ? (
            <div className="space-y-2">
              {interviewEvidence.map((quote, idx) => (
                <div key={idx} className="p-2 rounded bg-background border text-xs">
                  <p className="text-foreground leading-relaxed italic">
                    "{quote}"
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No spoken evidence captured during audio turns.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
