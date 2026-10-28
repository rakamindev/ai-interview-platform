import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { EvidenceRef } from "@/types";

interface EvidenceListProps {
  evidence: string[];
  refs?: EvidenceRef[];
  unverifiedCount?: number;
  /** Base path of the transcript page; quotes link to `${transcriptPath}#turn-N`. */
  transcriptPath: string;
}

export default function EvidenceList({ evidence, refs = [], unverifiedCount = 0, transcriptPath }: EvidenceListProps) {
  const items: EvidenceRef[] = refs.length
    ? refs
    : evidence.map((quote) => ({ quote, turn_number: 0 }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Evidence from the interview
      </div>

      {items.length === 0 ? (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            None of the quotes the AI cited could be found in the transcript. Read the transcript before relying on
            this rating.
          </span>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={`${item.turn_number}-${i}`} className="border-l-2 border-primary/40 pl-3">
              <blockquote className="text-sm leading-relaxed text-foreground break-words">“{item.quote}”</blockquote>
              {item.turn_number > 0 && (
                <Link
                  to={`${transcriptPath}#turn-${item.turn_number}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden />
                  Found in transcript · turn {item.turn_number}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {unverifiedCount > 0 && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {unverifiedCount} other {unverifiedCount === 1 ? "quote" : "quotes"} cited by the AI could not be found in
          the transcript and {unverifiedCount === 1 ? "was" : "were"} removed.
        </p>
      )}
    </div>
  );
}
