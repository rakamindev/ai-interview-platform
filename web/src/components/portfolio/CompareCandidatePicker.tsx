import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { VERDICT_BADGE_CLASSES } from "@/utils/verdictBadge";
import { candidatesApi } from "@/services/candidates";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Search, UserRound } from "lucide-react";
import type { Candidate } from "@/types";

interface CompareCandidatePickerProps {
  assessmentId: number;
  excludeSessionId: number;
  onSelect: (candidate: Candidate) => void;
}

export default function CompareCandidatePicker({
  assessmentId,
  excludeSessionId,
  onSelect,
}: CompareCandidatePickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    candidatesApi
      .list(assessmentId, { interview_status: "completed", search: debouncedSearch || undefined })
      .then((res) => {
        if (cancelled) return;
        setCandidates(res.data.candidates.filter((c) => c.session_id !== excludeSessionId));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentId, excludeSessionId, debouncedSearch]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Compare with</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Pick a completed candidate from this assessment</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search candidate name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Loading candidates...</p>
      ) : error ? (
        <p className="text-xs text-destructive text-center py-8">Couldn't load candidates.</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <UserRound className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">
            {search ? "No candidates match this search." : "No other completed candidates yet to compare with."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto">
          {candidates.map((c) => (
            <button
              key={c.candidate_id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left hover:bg-accent hover:shadow-sm transition-all"
            >
              <span className="text-sm font-medium truncate">
                {c.candidate_name || `Candidate ${c.candidate_id}`}
              </span>
              {c.verdict && (
                <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${VERDICT_BADGE_CLASSES[c.verdict]}`}>
                  {c.verdict}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
