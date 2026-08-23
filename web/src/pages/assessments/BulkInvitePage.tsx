import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Plus,
  Upload,
  X,
  GripVertical,
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";
import { api } from "@/services/api";
import { m } from "@/paraglide/messages.js";

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

function SortableCandidateRow({
  row,
  index,
  onUpdate,
  onRemove
}: {
  row: CandidateRow;
  index: number;
  onUpdate: (id: string, field: "name" | "email", value: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm text-muted-foreground w-6 text-right">{index + 1}</span>
      <Input
        placeholder={m.assessment_candidate_name()}
        value={row.name}
        onChange={(e) => onUpdate(row.id, "name", e.target.value)}
        className="flex-1"
        disabled={row.status === "loading"}
      />
      <Input
        placeholder="email@example.com"
        type="email"
        value={row.email}
        onChange={(e) => onUpdate(row.id, "email", e.target.value)}
        className="flex-1"
        disabled={row.status === "loading"}
      />
      <div className="w-6 flex items-center justify-center">
        {row.status === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {row.status === "success" && <Check className="h-4 w-4 text-green-600" />}
        {row.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Remove candidate"
        disabled={row.status === "loading"}
      >
        <X className="h-4 w-4" />
      </button>
      {row.status === "error" && row.message && (
        <p className="text-xs text-destructive ml-8 -mt-1">{row.message}</p>
      )}
    </div>
  );
}

let rowIdCounter = 0;
function newRow(name = "", email = ""): CandidateRow {
  return { id: `row-${++rowIdCounter}`, name, email, status: "idle" };
}

export default function BulkInvitePage() {
  const { id: assessmentId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<CandidateRow[]>(() => [newRow(), newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (id: string) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const updateRow = (id: string, field: "name" | "email", value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((prev) => {
        const oldIndex = prev.findIndex((r) => r.id === active.id);
        const newIndex = prev.findIndex((r) => r.id === over.id);
        const next = [...prev];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      });
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      // Skip header if present
      const startIdx =
        lines[0]?.toLowerCase().includes("name") && lines[0]?.toLowerCase().includes("email")
          ? 1
          : 0;
      const parsed: CandidateRow[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          parsed.push(newRow(parts[0], parts[1]));
        }
      }
      if (parsed.length > 0) setRows(parsed);
    });
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSendAll = async () => {
    const validRows = rows.filter((r) => r.name.trim() && r.email.trim());
    if (validRows.length === 0) {
      setError(m.assessment_add_at_least_one());
      return;
    }
    setError(null);
    setSubmitting(true);

    // Mark all as loading
    setRows((prev) =>
      prev.map((r) => (r.name.trim() && r.email.trim() ? { ...r, status: "loading" as const } : r))
    );

    try {
      const res = await api.post(`/assessments/${assessmentId}/bulk_invite`, {
        candidates: validRows.map((r) => ({ name: r.name, email: r.email }))
      });
      const results = res.data.results as Array<{
        email: string;
        status: "created" | "error";
        message?: string;
        invite_url?: string;
      }>;
      setRows((prev) =>
        prev.map((r) => {
          const result = results.find((x) => x.email === r.email);
          if (!result) return r;
          return {
            ...r,
            status: result.status === "created" ? "success" : "error",
            message: result.message
          };
        })
      );
    } catch {
      setError(m.bulk_invite_batch_error());
      setRows((prev) => prev.map((r) => ({ ...r, status: "error", message: m.bulk_invite_request_error() })));
    } finally {
      setSubmitting(false);
    }
  };

  const successCount = rows.filter((r) => r.status === "success").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <main className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link
          to="/assessments"
          className="text-muted-foreground hover:text-foreground"
          aria-label={m.common_back_to_assessments()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">{m.nav_assessments()}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{m.assessment_bulk_invite()}</span>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {m.assessment_invite_candidate()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{m.assessment_bulk_invite_desc()}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {m.assessment_import_csv()}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
        </div>

        {/* Candidate rows */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <SortableCandidateRow
                  key={row.id}
                  row={row}
                  index={index}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {m.assessment_add_row()}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Summary */}
        {(successCount > 0 || errorCount > 0) && (
          <div className="text-sm text-muted-foreground">
            {successCount > 0 && (
              <span className="text-green-600">
                {successCount} {m.assessment_sent()}
              </span>
            )}
            {successCount > 0 && errorCount > 0 && <span> · </span>}
            {errorCount > 0 && (
              <span className="text-destructive">
                {errorCount} {m.assessment_bulk_failed()}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            {m.assessment_done()}
          </Button>
          <Button
            type="button"
            onClick={handleSendAll}
            disabled={submitting || rows.every((r) => !r.name.trim() || !r.email.trim())}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {m.assessment_send_invites()}
          </Button>
        </div>
      </div>
    </main>
  );
}
