import React from "react";
import axios from "axios";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { vacanciesApi } from "@/services/vacancies";
import type { AssessmentSkill } from "@/types"; // SkillPicker passes AssessmentSkill-like data
import { vacancySchema } from "@/pages/vacancies/vacancySchema";

export const useVacancyNewPage = () => {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof vacancySchema>>({
    resolver: zodResolver(vacancySchema),
    mode: "onChange",
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });

  const { handleSubmit, control, setValue, watch } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  const addB7Skill = React.useCallback(
    (skill: Partial<AssessmentSkill>) => {
      // Map AssessmentSkill-like data from SkillPicker to VacancySkill schema
      append({
        skill_id: skill.skill_id,
        skill_label: skill.skill_label || "", // Ensure string
        expected_level: skill.expected_level || 3, // Default if not provided
      });
    },
    [append, fields.length]
  );

  const onSubmit = React.useCallback(
    async (data: z.infer<typeof vacancySchema>) => {
      setError(null);
      setSubmitting(true);

      try {
        const payload = {
          role_title: data.role_title,
          culture_dimensions: data.culture_dimensions || "",
          competency_expectations: data.competency_expectations || "",
          vacancy_skills_attributes: data.skills.map((skill, index) => ({
            ...skill,
            display_order: index,
          })),
        };

        await vacanciesApi.create(payload);

        navigate("/vacancies");
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(
            e.response?.data?.errors?.[0]?.message ??
            "Unable to create vacancy. Please try again."
          );
        } else {
          setError("Unable to create vacancy. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [navigate]
  );

  return {
    form,
    fields,
    submitting,
    pickerOpen,
    error,
    remove,
    addB7Skill,
    onSubmit,
    setPickerOpen,
    handleSubmit,
    setValue,
    watch,
    setError,
  };
};