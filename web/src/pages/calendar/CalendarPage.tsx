import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingBar } from "@/components/ui/loading";
import { usePageTitle } from "@/hooks/usePageTitle";
import { pipelineApi, type PipelineSession } from "@/services/pipeline";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Radio,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Eye,
  Search,
  X,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type EventType = "invited" | "started" | "ended" | "failed";

interface CalendarEvent {
  date: string; // "YYYY-MM-DD"
  time: string; // ISO string
  type: EventType;
  label: string;
  session: PipelineSession;
}

// ── Constants ────────────────────────────────────────────────────────────────

const EVENT_STYLES: Record<EventType, { dot: string; bg: string; text: string; border: string; Icon: React.ElementType; label: string }> = {
  invited:  { dot: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-800",   Icon: Mail,         label: "Invited" },
  started:  { dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-800", Icon: Radio,        label: "Started" },
  ended:    { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-800", Icon: CheckCircle2, label: "Completed" },
  failed:   { dot: "bg-rose-500",    bg: "bg-rose-50 dark:bg-rose-950/30",    text: "text-rose-700 dark:text-rose-300",   border: "border-rose-300 dark:border-rose-800",   Icon: AlertCircle,  label: "Failed" },
};

const ALL_EVENT_TYPES: EventType[] = ["invited", "started", "ended", "failed"];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildEvents(sessions: PipelineSession[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const s of sessions) {
    if (s.created_at) {
      events.push({
        date: toLocalDate(s.created_at),
        time: s.created_at,
        type: "invited",
        label: "Candidate invited",
        session: s,
      });
    }
    if (s.started_at) {
      events.push({
        date: toLocalDate(s.started_at),
        time: s.started_at,
        type: "started",
        label: "Interview started",
        session: s,
      });
    }
    if (s.ended_at) {
      const type: EventType = s.end_reason === "error" ? "failed" : "ended";
      events.push({
        date: toLocalDate(s.ended_at),
        time: s.ended_at,
        type,
        label: type === "failed" ? "Interview failed" : "Interview completed",
        session: s,
      });
    }
  }
  return events.sort((a, b) => a.time.localeCompare(b.time));
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startDow);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  usePageTitle("Calendar");

  const today = new Date();
  const [sessions, setSessions] = useState<PipelineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [year, setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(dateKey(today));

  // ── Filters & Search state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(ALL_EVENT_TYPES);
  const [selectedAssessment, setSelectedAssessment] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await pipelineApi.getSessions();
      setSessions(res.data.sessions);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // Unique assessment names for the filter dropdown
  const assessmentsList = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.assessment_name) set.add(s.assessment_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Build raw events
  const allEvents = useMemo(() => buildEvents(sessions), [sessions]);

  // Apply filters & search query
  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allEvents.filter((ev) => {
      // Event type filter
      if (!selectedTypes.includes(ev.type)) return false;

      // Assessment filter
      if (selectedAssessment !== "all" && ev.session.assessment_name !== selectedAssessment) {
        return false;
      }

      // Search query (Candidate name or assessment name or label)
      if (q) {
        const candidateMatch = (ev.session.candidate_name || `Candidate #${ev.session.id}`)
          .toLowerCase()
          .includes(q);
        const assessmentMatch = (ev.session.assessment_name || "")
          .toLowerCase()
          .includes(q);
        const labelMatch = ev.label.toLowerCase().includes(q);
        if (!candidateMatch && !assessmentMatch && !labelMatch) return false;
      }

      return true;
    });
  }, [allEvents, searchQuery, selectedTypes, selectedAssessment]);

  // Group filtered events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of filteredEvents) {
      (map[ev.date] ??= []).push(ev);
    }
    return map;
  }, [filteredEvents]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const todayKey = dateKey(today);
  const selectedEvents = eventsByDate[selected] ?? [];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(todayKey);
  };

  // Toggle individual event type filter
  const toggleEventType = (type: EventType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        // If clicking the only active one, reset to all
        if (prev.length === 1) return ALL_EVENT_TYPES;
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const selectAllTypes = () => {
    setSelectedTypes(ALL_EVENT_TYPES);
  };

  const isFiltered =
    searchQuery.trim() !== "" ||
    selectedTypes.length !== ALL_EVENT_TYPES.length ||
    selectedAssessment !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTypes(ALL_EVENT_TYPES);
    setSelectedAssessment("all");
  };

  // Find next date with matching events if selected date is empty
  const jumpToFirstMatch = () => {
    const datesWithEvents = Object.keys(eventsByDate).sort();
    if (datesWithEvents.length > 0) {
      const target = datesWithEvents[0];
      setSelected(target);
      const [tYear, tMonth] = target.split("-").map(Number);
      setYear(tYear);
      setMonth(tMonth - 1);
    }
  };

  if (loading) return <CalendarSkeleton />;

  if (error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Failed to load calendar data.</p>
        <Button variant="outline" size="sm" onClick={load}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300 relative">
      {/* Top Indeterminate Loading Bar during refresh */}
      {refreshing && (
        <div className="absolute -top-4 inset-x-0">
          <LoadingBar />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Session activity timeline by date — track invitations, live interviews, and evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFiltered && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Showing <strong>{filteredEvents.length}</strong> of {allEvents.length} events
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset filters
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
          >
            <RotateCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col md:flex-row gap-3 p-3 rounded-xl border bg-card shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, assessment, or event..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Assessment Dropdown Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedAssessment}
              onChange={(e) => setSelectedAssessment(e.target.value)}
              className="h-8 pl-3 pr-8 text-xs bg-background border border-border rounded-md outline-none focus:border-primary/60 cursor-pointer appearance-none text-foreground"
            >
              <option value="all">All Assessments ({assessmentsList.length})</option>
              {assessmentsList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        </div>

        {/* Event Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 md:pt-0 border-t md:border-t-0 border-border">
          <button
            onClick={selectAllTypes}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border transition-all font-medium",
              selectedTypes.length === ALL_EVENT_TYPES.length
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            All
          </button>
          {ALL_EVENT_TYPES.map((type) => {
            const s = EVENT_STYLES[type];
            const Icon = s.Icon;
            const isSelected = selectedTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleEventType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all",
                  isSelected
                    ? cn(s.bg, s.text, s.border, "font-medium shadow-2xs")
                    : "opacity-40 hover:opacity-80 bg-background text-muted-foreground border-border"
                )}
                title={`Filter by ${s.label}`}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
                <Icon className="h-3 w-3 shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Calendar ── */}
        <div className="flex-1 w-full min-w-0 border rounded-xl overflow-hidden bg-background">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-sm font-semibold min-w-[140px] text-center">
                {MONTH_NAMES[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                aria-label="Next month"
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToday}>
              Today
            </Button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const key = dateKey(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = key === todayKey;
              const isSelected = key === selected;
              const events = eventsByDate[key] ?? [];

              // Collect unique event types for dots
              const types = [...new Set(events.map((e) => e.type))];

              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "relative min-h-[74px] p-1.5 border-b border-r text-left transition-colors",
                    "last:border-r-0",
                    isCurrentMonth ? "bg-background hover:bg-muted/30" : "bg-muted/10 hover:bg-muted/20",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && isCurrentMonth && "text-foreground",
                      !isToday && !isCurrentMonth && "text-muted-foreground/40",
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots */}
                  {types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {types.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className={cn("h-1.5 w-1.5 rounded-full", EVENT_STYLES[t].dot)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Event count badge */}
                  {events.length > 0 && (
                    <span className="absolute bottom-1 right-1.5 text-[10px] font-medium text-muted-foreground/70">
                      {events.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Event panel ── */}
        <div className="w-full lg:w-80 shrink-0 border rounded-xl overflow-hidden bg-background">
          {/* Panel header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                {new Date(selected + "T00:00:00").toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedEvents.length === 0
                  ? "No matching events"
                  : `${selectedEvents.length} event${selectedEvents.length > 1 ? "s" : ""}`}
              </p>
            </div>

            {selected !== todayKey && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(todayKey)}
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              >
                Go to today
              </Button>
            )}
          </div>

          {/* Events list */}
          <div className="divide-y max-h-[520px] overflow-y-auto">
            {selectedEvents.length === 0 ? (
              <div className="px-4 py-10 text-center space-y-2">
                <p className="text-xs text-muted-foreground/70">
                  {isFiltered
                    ? "No events matching your filter on this day."
                    : "No session activity on this day."}
                </p>
                {isFiltered && Object.keys(eventsByDate).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={jumpToFirstMatch}
                  >
                    Jump to nearest event
                  </Button>
                )}
                {isFiltered && (
                  <div>
                    <button
                      onClick={resetFilters}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear active filters
                    </button>
                  </div>
                )}
              </div>
            ) : (
              selectedEvents.map((ev, i) => (
                <EventCard key={i} event={ev} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const navigate = useNavigate();
  const { type, label, time, session } = event;
  const style = EVENT_STYLES[type];
  const Icon = style.Icon;
  const displayName = session.candidate_name || `Candidate #${session.id}`;

  const handleAction = () => {
    if (session.status === "active") {
      navigate(`/assessments/${session.assessment_id}/sessions/${session.id}/monitor`);
    } else if (session.status === "ended" && session.end_reason !== "error") {
      navigate(`/assessments/${session.assessment_id}/sessions/${session.id}/portfolio`);
    }
  };

  const canNavigate =
    session.status === "active" ||
    (session.status === "ended" && session.end_reason !== "error");

  return (
    <div className={cn("px-4 py-3 space-y-1.5 transition-colors", style.bg)}>
      {/* Event type + time */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", style.text)}>
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {toLocalTime(time)}
        </span>
      </div>

      {/* Candidate & assessment */}
      <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
      {session.assessment_name && (
        <p className="text-[11px] text-muted-foreground truncate">{session.assessment_name}</p>
      )}

      {/* Duration (for ended events) */}
      {type === "ended" && session.duration_seconds && session.duration_seconds > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Duration: {Math.round(session.duration_seconds / 60)} min
        </p>
      )}

      {/* Action button */}
      {canNavigate && (
        <button
          onClick={handleAction}
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          {session.status === "active" ? (
            <><Eye className="h-3 w-3" /> Monitor live</>
          ) : (
            <><FileText className="h-3 w-3" /> View portfolio</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex gap-4">
        <div className="flex-1 border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-7 w-16" />
          </div>
          <div className="grid grid-cols-7 gap-px p-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="w-80 border rounded-xl">
          <div className="p-4 border-b space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
