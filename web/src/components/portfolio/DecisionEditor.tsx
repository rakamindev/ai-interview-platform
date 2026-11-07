import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  initialLevel?: number | null;
  initialNotes?: string;
  saving: boolean;
  error?: string | null;
  onSave: (level: number, notes: string) => void;
  onCancel: () => void;
}

/** Inline, on-demand editor for the assessor's own level. Shown only after "Change level" / "Set level". */
export default function DecisionEditor({ initialLevel, initialNotes, saving, error, onSave, onCancel }: Props) {
  const [level, setLevel] = useState<number | null>(initialLevel ?? null);
  const [notes, setNotes] = useState(initialNotes ?? "");

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Your level" className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => setLevel(l)}
            className={cn(
              "h-9 min-w-[3rem] rounded-md border px-3 text-sm font-medium transition-colors",
              level === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            L{l}
          </button>
        ))}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Why? (helps the next reviewer)"
        rows={2}
        className="text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!level || saving} onClick={() => level && onSave(level, notes)}>
          {saving ? "Saving…" : "Save decision"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
