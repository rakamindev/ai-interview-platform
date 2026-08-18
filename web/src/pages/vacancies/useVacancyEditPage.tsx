import React from "react";
import axios from "axios";
import { z } from "zod";
import { UseFormReturn } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { vacanciesApi } from "@/services/vacancies";
import { vacancySchema, vacancySkillSchema } from "@/pages/vacancies/vacancySchema";

interface Props {
  id?: string | null;
  form: UseFormReturn<z.infer<typeof vacancySchema>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useVacancyEditPage = ({ id, form, setError }: Props) => {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState(false);
  const [deletedSkills, setDeletedSkills] = React.useState<z.infer<typeof vacancySkillSchema>[]>([]);

  const onSubmit = React.useCallback(
    async (data: z.infer<typeof vacancySchema>) => {
      if (!id) {
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        await vacanciesApi.update(Number(id), {
          role_title: data.role_title,
          culture_dimensions: data.culture_dimensions || "",
          competency_expectations: data.competency_expectations || "",
          vacancy_skills_attributes: [...data.skills, ...deletedSkills].map((s, i) => ({
            ...(s.id !== undefined && { id: s.skill_id || s.id }),
            skill_label: s.skill_label,
            expected_level: s.expected_level,
            ...(s._destroy !== undefined && {
              _destroy: s._destroy,
            }),
          })),
        });

        navigate("/vacancies");
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(
            e.response?.data?.errors?.[0]?.message ??
            "Unable to save vacancy. Please try again."
          );
        } else {
          setError("Unable to save vacancy. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [id, navigate, setError, deletedSkills]
  );

  const refetchData = React.useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setFetchError(false);

    try {
      const res = await vacanciesApi.get(Number(id));
      const vacancy = res.data.vacancy;

      form.reset({
        role_title: vacancy.role_title,
        culture_dimensions: vacancy.culture_dimensions,
        competency_expectations: vacancy.competency_expectations,
        skills: vacancy.skills?.map((skill) => ({
          ...skill,
          id: skill.id,
          skill_id: skill.id, // for skill.id because id rendered to be uid
        })),
      });
    } catch (error) {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  React.useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      await refetchData();
      if (!mounted) return;
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [refetchData]);

  return {
    loading,
    fetchError,
    submitting,
    setDeletedSkills,
    onSubmit,
    refetchData,
  };
};