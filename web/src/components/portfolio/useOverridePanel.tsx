import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { portfoliosApi } from "@/services/portfolios";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface useOverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export const useOverridePanel = ({ skill, existingOverride, onSaved }: useOverridePanelProps) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? parseLevel(skill.ai_level));
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasOverride = !!existingOverride;

  // Effect to handle clicks outside the panel to close it
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Effect to reset form state when the panel is opened
  useEffect(() => {
    if (open) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(null);
    }
  }, [open, existingOverride, skill.ai_level]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch (e) {
      let message = "Failed to save override. Please try again.";
      if (axios.isAxiosError(e) && e.response?.data?.errors?.[0]?.message) {
        message = e.response.data.errors[0].message;
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    setOpen,
    panelRef,
    overrideLevel,
    setOverrideLevel,
    notes,
    setNotes,
    saving,
    saveError,
    hasOverride,
    handleSave,
  };
};