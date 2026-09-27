
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import {
  LEVEL_DESCRIPTIONS,
  parseLevel,
} from "@/utils/constants";

import type {
  PortfolioSkill,
  AssessorOverride,
} from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

const levels = [1, 2, 3, 4, 5];

export default function OverridePanel({
  skill,
  existingOverride,
  onSaved,
}: OverridePanelProps) {
  const [open, setOpen] = useState(false);

  const [overrideLevel, setOverrideLevel] =
    useState(
      existingOverride?.override_level ??
        parseLevel(skill.ai_level)
    );

  const [notes, setNotes] = useState(
    existingOverride?.assessor_notes ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const aiLevel = parseLevel(skill.ai_level);
  const hasOverride = Boolean(existingOverride);

  const handleOpen = () => {
    setOverrideLevel(
      existingOverride?.override_level ?? aiLevel
    );

    setNotes(
      existingOverride?.assessor_notes ?? ""
    );

    setSaveError(false);
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setSaveError(false);
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setSaveError(false);

    try {
      const response = await portfoliosApi.getOverride(
        skill.id,
        {
          override_level: overrideLevel,
          assessor_notes: notes.trim(),
        }
      );

      onSaved(response.data.override);
      setOpen(false);
    } catch (error) {
      console.error(
        "Failed to save assessor override:",
        error
      );

      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {hasOverride && existingOverride ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />

              <span className="text-xs font-medium text-emerald-800">
                Assessor rating
              </span>

              <LevelBadge
                level={existingOverride.override_level}
                size="sm"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
              className="h-9 rounded-lg"
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit rating
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpen}
            className="h-9 rounded-lg border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Override rating
          </Button>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-slate-200 p-0">
          <DialogHeader className="space-y-3 border-b border-slate-100 px-6 pb-5 pt-6 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Pencil className="h-5 w-5" />
            </div>

            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              Override Skill Rating
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-slate-500">
              Review the AI assessment and set your
              own competency rating for this skill.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Selected Skill
              </p>

              <p className="mt-2 break-words text-base font-semibold text-slate-900">
                {skill.skill_label}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    AI rating
                  </span>

                  <LevelBadge
                    level={aiLevel}
                    size="sm"
                  />
                </div>

                {hasOverride && existingOverride && (
                  <>
                    <ArrowRight className="h-4 w-4 text-slate-400" />

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Your rating
                      </span>

                      <LevelBadge
                        level={
                          existingOverride.override_level
                        }
                        size="sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold text-slate-900">
                  Your Rating
                </Label>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Select the competency level based on
                  your assessment of the interview evidence.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Competency rating"
                className="grid grid-cols-5 gap-2"
              >
                {levels.map((level) => {
                  const selected =
                    overrideLevel === level;

                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Level ${level}: ${
                        LEVEL_DESCRIPTIONS[level]
                      }`}
                      disabled={saving}
                      onClick={() => {
                        setOverrideLevel(level);
                      }}
                      className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-base font-bold">
                        L{level}
                      </span>

                      {selected && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}

                      {!selected && (
                        <span className="h-4" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg bg-primary/5 px-3 py-2.5">
                <p className="text-sm font-semibold text-primary">
                  Level {overrideLevel}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {LEVEL_DESCRIPTIONS[overrideLevel]}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={`override-notes-${skill.id}`}
                className="text-sm font-semibold text-slate-900"
              >
                Assessor Notes
                <span className="ml-1 font-normal text-slate-400">
                  (Optional)
                </span>
              </Label>

              <Textarea
                id={`override-notes-${skill.id}`}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
                disabled={saving}
                rows={4}
                placeholder="Explain the evidence or reasoning behind your rating..."
                className="min-h-28 resize-y rounded-xl border-slate-200 text-sm leading-6 focus-visible:ring-primary"
              />

              <p className="text-xs leading-5 text-slate-500">
                Notes help other assessors understand
                the context behind your decision.
              </p>
            </div>

            {saveError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                <p className="text-xs leading-5 text-red-700">
                  Failed to save your rating.
                  Please try again.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
              disabled={saving}
              className="h-10 rounded-xl"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving}
              className="h-10 rounded-xl px-5"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save Override
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}