import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Loader2, History } from "lucide-react";
import { api } from "@/services/api";
import { LEVEL_LABELS } from "@/utils/constants";

interface OverrideEvent {
  id: number;
  portfolio_skill_id: number;
  skill_label: string;
  candidate_name: string;
  assessment_name: string;
  ai_level: number;
  override_level: number;
  assessor_notes: string;
  overridden_by: number | null;
  assessor_email: string | null;
  overridden_at: string | null;
}

interface OverrideEventsResponse {
  override_events: OverrideEvent[];
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

export default function OverrideHistoryPage() {
  const [events, setEvents] = useState<OverrideEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [assessorFilter, setAssessorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page };
      if (assessorFilter) params.assessor_email = assessorFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (skillFilter) params.skill_label = skillFilter;

      const res = await api.get<OverrideEventsResponse>("/override_events", { params });
      setEvents(res.data.override_events ?? []);
      setTotalPages(res.data.meta?.total_pages ?? 1);
    } catch {
      setError("Failed to load override history.");
    } finally {
      setLoading(false);
    }
  }, [page, assessorFilter, dateFrom, dateTo, skillFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <main className="max-w-4xl mx-auto">
      <PageHeader
        title="Assessor Override History"
        description="Tenant-wide audit log of every AI rating an assessor has overridden."
        eyebrow="Audit"
        backTo="/assessments"
        backLabel="Back to assessments"
      />

      {/* Filters */}
      <div className="border rounded-lg p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="assessor">Assessor email</Label>
            <Input
              id="assessor"
              placeholder="filter@example.com"
              value={assessorFilter}
              onChange={(e) => setAssessorFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateFrom">From date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateTo">To date</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill">Skill name</Label>
            <Input
              id="skill"
              placeholder="React, Python..."
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAssessorFilter("");
              setDateFrom("");
              setDateTo("");
              setSkillFilter("");
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No override events found"
          description="Overrides an assessor makes on a candidate's AI-rated skills will show up here."
        />
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Candidate</th>
                  <th className="text-left p-3 font-medium">Skill</th>
                  <th className="text-center p-3 font-medium">AI Level</th>
                  <th className="text-center p-3 font-medium">Override</th>
                  <th className="text-left p-3 font-medium">Assessor</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div>
                        <span className="font-medium">{event.candidate_name}</span>
                        <span className="text-muted-foreground ml-1">
                          ({event.assessment_name})
                        </span>
                      </div>
                    </td>
                    <td className="p-3">{event.skill_label}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium">
                        {LEVEL_LABELS[event.ai_level] ?? event.ai_level}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {LEVEL_LABELS[event.override_level] ?? event.override_level}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{event.assessor_email ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {event.overridden_at
                        ? new Date(event.overridden_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                      {event.assessor_notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
