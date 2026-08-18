import React from "react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";
import { SkillPickerProps } from "@/components/assessment/SkillPicker";

export const useSkillPicker = ({ open, onOpenChange, onSelect }: SkillPickerProps) => {
  const [skills, setSkills] = React.useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState(false);

  const getSkills = React.useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const res = await skillTaxonomiesApi.list();

      setSkills(res.data.skill_taxonomies ?? []);
    } catch {
      setSkills([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void getSkills();
  }, [open, getSkills]);

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return skills.filter((skill) =>
      skill.skill_label.toLowerCase().includes(normalizedQuery)
    );
  }, [skills, query]);

  const handleSelect = React.useCallback((s: SkillTaxonomy) => {
    onSelect({
      skill_id: undefined,
      skill_label: s.skill_label,
      is_custom: false,
      expected_level: 3,
      scope_include: s.scope_include,
      l1_anchor: s.l1_anchor,
      l2_anchor: s.l2_anchor,
      l3_anchor: s.l3_anchor,
      l4_anchor: s.l4_anchor,
      l5_anchor: s.l5_anchor,
    });
    onOpenChange(false);
    setQuery("");
  }, []);

  return {
    error,
    loading,
    query,
    filtered,
    getSkills,
    handleSelect,
    setQuery,
  };
}