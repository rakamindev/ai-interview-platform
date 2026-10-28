import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingBar } from "@/components/ui/loading";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  pipelineApi,
  deriveColumn,
  type PipelineSession,
  type KanbanColumn,
  type PipelineStage,
} from "@/services/pipeline";
import {
  Clock,
  Radio,
  CheckCircle2,
  Star,
  Briefcase,
  XCircle,
  Mail,
  Eye,
  FileText,
  GripVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

interface ColumnDef {
  id: KanbanColumn;
  label: string;
  icon: React.ElementType;
  color: string;
  headerColor: string;
  draggable: boolean;
  droppable: boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "invited",
    label: "Invited",
    icon: Mail,
    color: "border-blue-200 dark:border-blue-800",
    headerColor: "text-blue-600 dark:text-blue-400",
    draggable: false,
    droppable: false,
  },
  {
    id: "interviewing",
    label: "Interviewing",
    icon: Radio,
    color: "border-amber-200 dark:border-amber-800",
    headerColor: "text-amber-600 dark:text-amber-400",
    draggable: false,
    droppable: false,
  },
  {
    id: "evaluated",
    label: "Evaluated",
    icon: CheckCircle2,
    color: "border-violet-200 dark:border-violet-800",
    headerColor: "text-violet-600 dark:text-violet-400",
    draggable: true,
    droppable: true,
  },
  {
    id: "shortlisted",
    label: "Shortlisted",
    icon: Star,
    color: "border-indigo-200 dark:border-indigo-800",
    headerColor: "text-indigo-600 dark:text-indigo-400",
    draggable: true,
    droppable: true,
  },
  {
    id: "hired",
    label: "Hired",
    icon: Briefcase,
    color: "border-emerald-200 dark:border-emerald-800",
    headerColor: "text-emerald-600 dark:text-emerald-400",
    draggable: true,
    droppable: true,
  },
  {
    id: "rejected",
    label: "Rejected",
    icon: XCircle,
    color: "border-rose-200 dark:border-rose-800",
    headerColor: "text-rose-500 dark:text-rose-400",
    draggable: true,
    droppable: true,
  },
];

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));

// Map column id → pipeline_stage value for API
const COLUMN_TO_STAGE: Record<string, PipelineStage> = {
  shortlisted: "shortlisted",
  hired: "hired",
  rejected: "rejected",
  evaluated: null,
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  usePageTitle("Pipeline");
  const [sessions, setSessions] = useState<PipelineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeSession, setActiveSession] = useState<PipelineSession | null>(null);

  // Per-column search & page state
  const [searches, setSearches] = useState<Record<KanbanColumn, string>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, ""])) as Record<KanbanColumn, string>
  );
  const [pages, setPages] = useState<Record<KanbanColumn, number>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, 1])) as Record<KanbanColumn, number>
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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

  useEffect(() => {
    load();
  }, [load]);

  // Group all sessions by derived column (for looking up which column a card id belongs to)
  const grouped = COLUMNS.reduce<Record<KanbanColumn, PipelineSession[]>>(
    (acc, col) => {
      acc[col.id] = sessions.filter((s) => deriveColumn(s) === col.id);
      return acc;
    },
    {} as Record<KanbanColumn, PipelineSession[]>
  );

  /** Given an `over.id` (could be column id or session id), find the target column */
  const resolveTargetColumn = (overId: string | number): KanbanColumn | null => {
    const overStr = String(overId);
    // Direct column drop
    if (COLUMN_IDS.has(overStr)) return overStr as KanbanColumn;
    // Over a card — find which column that card belongs to
    const overSession = sessions.find((s) => s.id === Number(overId));
    if (overSession) return deriveColumn(overSession);
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id);
    setActiveSession(sessions.find((s) => s.id === id) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveSession(null);
    const { active, over } = event;
    if (!over) return;

    const sessionId = Number(active.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const currentCol = deriveColumn(session);
    const targetColId = resolveTargetColumn(over.id);
    if (!targetColId || currentCol === targetColId) return;

    const targetColDef = COLUMNS.find((c) => c.id === targetColId);
    const currentColDef = COLUMNS.find((c) => c.id === currentCol);
    if (!targetColDef?.droppable || !currentColDef?.draggable) return;

    const newStage: PipelineStage = Object.prototype.hasOwnProperty.call(COLUMN_TO_STAGE, targetColId)
      ? COLUMN_TO_STAGE[targetColId]
      : null;

    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, pipeline_stage: newStage } : s))
    );

    try {
      await pipelineApi.updateStage(sessionId, newStage);
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, pipeline_stage: session.pipeline_stage } : s))
      );
    }
  };

  const handleSearch = (colId: KanbanColumn, value: string) => {
    setSearches((prev) => ({ ...prev, [colId]: value }));
    setPages((prev) => ({ ...prev, [colId]: 1 })); // reset to page 1 on search
  };

  const handlePage = (colId: KanbanColumn, page: number) => {
    setPages((prev) => ({ ...prev, [colId]: page }));
  };

  if (loading) return <PipelineSkeleton />;

  if (error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Failed to load pipeline data.</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recruitment Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag candidates across stages to track progress.
          </p>
        </div>
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

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-200px)] items-start">
          {COLUMNS.map((col) => (
            <KanbanColumnView
              key={col.id}
              column={col}
              allSessions={grouped[col.id]}
              search={searches[col.id]}
              page={pages[col.id]}
              onSearch={(v) => handleSearch(col.id, v)}
              onPage={(p) => handlePage(col.id, p)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeSession && (
            <SessionCard
              session={activeSession}
              column={COLUMNS.find((c) => c.id === deriveColumn(activeSession))!}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Column Component ─────────────────────────────────────────────────────────

function KanbanColumnView({
  column,
  allSessions,
  search,
  page,
  onSearch,
  onPage,
}: {
  column: ColumnDef;
  allSessions: PipelineSession[];
  search: string;
  page: number;
  onSearch: (v: string) => void;
  onPage: (p: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: !column.droppable,
  });

  const Icon = column.icon;

  // Filter by search
  const q = search.toLowerCase().trim();
  const filtered = q
    ? allSessions.filter(
        (s) =>
          (s.candidate_name ?? "").toLowerCase().includes(q) ||
          (s.assessment_name ?? "").toLowerCase().includes(q)
      )
    : allSessions;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div
      className={cn(
        "flex flex-col w-64 shrink-0 rounded-xl border bg-muted/20 transition-colors",
        column.color,
        isOver && column.droppable && "bg-muted/40 ring-1 ring-primary/40"
      )}
    >
      {/* Column header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-inherit">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("flex items-center gap-1.5 text-xs font-semibold", column.headerColor)}>
            <Icon className="h-3.5 w-3.5" />
            {column.label}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {allSessions.length}
          </span>
        </div>
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-6 pr-2 py-1 text-[11px] bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Cards area */}
      <SortableContext
        items={paginated.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[80px]">
          {paginated.length === 0 && (
            <div className="flex items-center justify-center h-14 text-[11px] text-muted-foreground/50 border border-dashed border-muted-foreground/20 rounded-lg">
              {q ? "No results" : column.droppable ? "Drop here" : "No candidates"}
            </div>
          )}
          {paginated.map((session) => (
            <SessionCard key={session.id} session={session} column={column} />
          ))}
        </div>
      </SortableContext>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="px-2 py-1.5 border-t border-inherit flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Component ───────────────────────────────────────────────────────────

function SessionCard({
  session,
  column,
  overlay = false,
}: {
  session: PipelineSession;
  column: ColumnDef;
  overlay?: boolean;
}) {
  const navigate = useNavigate();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: session.id,
    disabled: !column.draggable || overlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = session.candidate_name || `Candidate #${session.id}`;
  const isLive = session.status === "active";

  // Prevent drag when clicking action buttons
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Spread drag listeners on the whole card
      {...(column.draggable && !overlay ? attributes : {})}
      {...(column.draggable && !overlay ? listeners : {})}
      className={cn(
        "bg-background rounded-lg border p-2.5 select-none group",
        "transition-shadow",
        isDragging && "opacity-20 shadow-none",
        overlay && "shadow-xl rotate-1 scale-[1.02] opacity-95 cursor-grabbing",
        !overlay && column.draggable && "cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Visual grip indicator */}
        {column.draggable && !overlay && (
          <GripVertical className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        )}

        <div className="min-w-0 flex-1">
          {/* Name */}
          <p className="text-xs font-semibold truncate leading-tight">{displayName}</p>

          {/* Assessment */}
          {session.assessment_name && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {session.assessment_name}
            </p>
          )}

          {/* Live badge */}
          {isLive && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Live</span>
            </div>
          )}

          {/* Duration */}
          {!!session.duration_seconds && session.duration_seconds > 0 && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {Math.round(session.duration_seconds / 60)} min
            </div>
          )}

          {/* Action buttons — stop propagation so click doesn't trigger drag */}
          {(session.status === "active" ||
            (session.status === "ended" && session.end_reason !== "error")) && (
            <div className="flex gap-1 mt-2" onMouseDown={stopPropagation}>
              {session.status === "active" && (
                <button
                  onClick={() =>
                    navigate(
                      `/assessments/${session.assessment_id}/sessions/${session.id}/monitor`
                    )
                  }
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Eye className="h-2.5 w-2.5" /> Monitor
                </button>
              )}
              {session.status === "ended" && session.end_reason !== "error" && (
                <button
                  onClick={() =>
                    navigate(
                      `/assessments/${session.assessment_id}/sessions/${session.id}/portfolio`
                    )
                  }
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <FileText className="h-2.5 w-2.5" /> Portfolio
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function PipelineSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-64 shrink-0 rounded-xl border bg-muted/20 p-2.5 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-full" />
            {[1, 2].map((j) => (
              <Skeleton key={j} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
