import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, CheckCircle2, ArrowRight } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import { toast } from "@/components/ui/toast";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

const MIN_NOTES_LENGTH = 5;

export default function OverridePanel({
  skill,
  existingOverride,
  onSaved,
}: OverridePanelProps) {
  const aiNumericLevel = parseLevel(skill.ai_level);
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? aiNumericLevel
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  const hasOverride = !!existingOverride;
  const notesInputId = `override-notes-${skill.id}`;
  const errorMessageId = `override-error-${skill.id}`;

  useEffect(() => {
    if (!open && !saveError) {
      setOverrideLevel(existingOverride?.override_level ?? aiNumericLevel);
      setNotes(existingOverride?.assessor_notes ?? "");
    }
  }, [existingOverride, aiNumericLevel, open, saveError]);

  useEffect(() => {
    if (open) {
      notesTextareaRef.current?.focus();
    } else if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      triggerButtonRef.current?.focus();
    }
  }, [open]);

  const handleOpen = () => {
    setValidationError(null);
    setSaveError(null);
    setOverrideLevel(existingOverride?.override_level ?? aiNumericLevel);
    setNotes(existingOverride?.assessor_notes ?? "");
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    shouldRestoreFocusRef.current = true;
    setValidationError(null);
    setSaveError(null);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !saving) {
      e.stopPropagation();
      handleClose();
    }
  };

  const handleSave = async () => {
    if (saving) return;

    const trimmed = notes.trim();
    if (trimmed.length < MIN_NOTES_LENGTH) {
      setValidationError(
        `Please provide a brief rationale (at least ${MIN_NOTES_LENGTH} characters) explaining this override.`
      );
      notesTextareaRef.current?.focus();
      return;
    }

    setValidationError(null);
    setSaveError(null);
    setSaving(true);

    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: trimmed,
      });
      onSaved(res.data.override);
      shouldRestoreFocusRef.current = true;
      setOpen(false);
      toast.success(
        `Rating updated to L${overrideLevel} for ${skill.skill_label || "skill"}.`,
        "Override Saved"
      );
    } catch (err: unknown) {
      const errData = (
        err as {
          response?: {
            data?: {
              error?: string;
              errors?: Array<string | { message?: string }>;
            };
          };
        }
      )?.response?.data;
      const firstErr = errData?.errors?.[0];
      const serverMsg =
        errData?.error ??
        (typeof firstErr === "string" ? firstErr : firstErr?.message);
      const displayMsg = serverMsg
        ? `${serverMsg} (Your changes have been preserved.)`
        : "Failed to save override. Your changes have been preserved—please try again.";
      setSaveError(displayMsg);
      toast.error(serverMsg || "Failed to save override.", "Override Error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        {hasOverride ? (
          <>
            <div
              className="flex flex-wrap items-center gap-1.5 text-xs"
              aria-label={`AI rating L${aiNumericLevel} overridden to L${existingOverride.override_level}`}
            >
              <span className="text-[#64748B]">Rating change:</span>
              <LevelBadge level={aiNumericLevel} size="sm" />
              <span className="text-[#64748B]">AI</span>
              <ArrowRight className="h-3 w-3 text-[#64748B]" aria-hidden="true" />
              <LevelBadge level={existingOverride.override_level} size="sm" />
              <span className="inline-flex items-center gap-1 text-[#0B7479] font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0F8F95]" aria-hidden="true" />
                Overridden
              </span>
            </div>
            <Button
              ref={triggerButtonRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
              aria-expanded={open}
              className="h-8 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1.5" /> Edit override
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs text-[#64748B]">
              Adjust competency level with documented rationale
            </span>
            <Button
              ref={triggerButtonRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
              aria-expanded={open}
              className="h-8 text-xs ml-auto"
            >
              <Pencil className="h-3 w-3 mr-1.5" />
              Override rating
            </Button>
          </>
        )}
      </div>
    );
  }

  const activeError = validationError || saveError;
  const trimmedLen = notes.trim().length;

  return (
    <div
      role="region"
      aria-label={`Assessor override for ${skill.skill_label}`}
      onKeyDown={handleKeyDown}
      aria-busy={saving}
      className="border border-[#E2E8F0] rounded-lg p-4 space-y-4 bg-[#F7F9FA] w-full"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold text-[#1F2937]">
            Override Competency Rating
          </h4>
          <p className="text-xs text-[#64748B]">
            Select the adjusted L1–L5 proficiency level and document the supporting interview evidence.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-[#E2E8F0] rounded-md px-2.5 py-1 text-[#64748B]">
          AI rating: <strong className="text-[#1F2937]">L{aiNumericLevel}</strong>
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-[#1F2937]">
          Adjusted Proficiency Level
        </Label>
        <LevelRadio
          value={overrideLevel}
          onChange={setOverrideLevel}
          disabled={saving}
          ariaLabel={`Override proficiency level for ${skill.skill_label}`}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={notesInputId} className="text-xs font-semibold text-[#1F2937]">
            Override rationale <span className="text-destructive">*</span>
          </Label>
          <span
            className={`text-xs ${
              validationError
                ? "text-destructive font-medium"
                : trimmedLen >= MIN_NOTES_LENGTH
                ? "text-[#0B7479] font-medium"
                : "text-[#64748B]"
            }`}
          >
            {trimmedLen}/{MIN_NOTES_LENGTH}+ min characters
          </span>
        </div>
        <Textarea
          ref={notesTextareaRef}
          id={notesInputId}
          value={notes}
          disabled={saving}
          aria-required="true"
          aria-invalid={!!activeError}
          aria-describedby={activeError ? errorMessageId : undefined}
          onChange={(e) => {
            setNotes(e.target.value);
            if (validationError && e.target.value.trim().length >= MIN_NOTES_LENGTH) {
              setValidationError(null);
            }
          }}
          rows={3}
          className={
            activeError
              ? "border-destructive focus-visible:ring-destructive/30 bg-white text-sm"
              : "bg-white border-[#E2E8F0] text-sm"
          }
          placeholder="Explain the behavioral evidence supporting this rating (min. 5 characters)..."
        />
        {activeError && (
          <p
            id={errorMessageId}
            role="alert"
            className="text-xs text-destructive font-medium pt-0.5"
          >
            {activeError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-xs text-[#64748B]">
          {saving ? "Saving override and refreshing alignment reports..." : "Press Esc to cancel"}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {saving ? "Saving..." : "Save override"}
          </Button>
        </div>
      </div>
    </div>
  );
}

