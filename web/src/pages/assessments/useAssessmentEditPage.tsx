import React from "react";
import axios from "axios";
import { z } from "zod";
import { UseFormReturn } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { assessmentsApi } from "@/services/assessments";
import {
  assessmentSchema,
  skillSchema,
} from "@/pages/assessments/assessmentSchema";

interface Props {
  id?: string;
  form: UseFormReturn<z.infer<typeof assessmentSchema>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

type SkillFormValues = z.infer<typeof skillSchema>;

export const useAssessmentEditPage = ({
  id,
  form,
  setError,
}: Props) => {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState(false);

  const [deletedSkills, setDeletedSkills] = React.useState<
    SkillFormValues[]
  >([]);

  const [error, setErrorState] = React.useState<string | null>(null);

  const onSubmit = React.useCallback(
    async (data: z.infer<typeof assessmentSchema>) => {
      if (!id) {
        return;
      }

      setError(null);
      setErrorState(null);
      setSubmitting(true);

      try {
        const skills = [...data.skills, ...deletedSkills];

        const assessmentSkillsAttributes = skills.map(
          (skill, index) => ({
            ...(skill.id !== undefined && {
              id: skill.skill_id || skill.id,
            }),

            skill_label: skill.skill_label,
            is_custom: skill.is_custom,
            expected_level: skill.expected_level,
            display_order: index,
            scope_include: skill.scope_include,
            scope_exclude: skill.scope_exclude,
            l1_anchor: skill.l1_anchor,
            l2_anchor: skill.l2_anchor,
            l3_anchor: skill.l3_anchor,
            l4_anchor: skill.l4_anchor,
            l5_anchor: skill.l5_anchor,

            ...(skill._destroy !== undefined && {
              _destroy: skill._destroy,
            }),
          })
        );

        await assessmentsApi.update(Number(id), {
          name: data.name,
          time_limit_min: data.time_limit_min,
          assessment_skills_attributes:
            assessmentSkillsAttributes,
        });

        navigate(`/assessments/${id}/invite`);
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(
            e.response?.data?.errors?.[0]?.message ??
            "Unable to save assessment. Please try again."
          );
        } else {
          setError(
            "Unable to save assessment. Please try again."
          );
        }
      } finally {
        setSubmitting(false);
      }
    },
    [id, navigate, setError, deletedSkills]
  );

  const refetchData = React.useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setFetchError(false);
    setErrorState(null);
    setDeletedSkills([]);

    try {
      const res = await assessmentsApi.get(Number(id));
      const assessment = res.data.assessment;

      form.reset({
        name: assessment.name,
        time_limit_min: assessment.time_limit_min,
        language: assessment.language,
        skills:
          assessment.skills?.map((skill) => ({
            ...skill,
            id: skill.id,
            skill_id: skill.id,
          })) ?? [],
      });
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  React.useEffect(() => {
    refetchData();
  }, [refetchData]);

  return {
    loading,
    fetchError,
    submitting,
    deletedSkills,
    setDeletedSkills,
    refetchData,
    onSubmit,
    error,
  };
};