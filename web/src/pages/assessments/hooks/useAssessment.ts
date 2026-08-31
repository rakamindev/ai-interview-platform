import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { assessmentsApi } from "@/services/assessments";
import type { AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function useAssessment() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorResponse, setErrorResponse] = useState<string | null>(null);
  const isEdit = Boolean(id);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const hasUnsavedChanges = Object.keys(form.formState.dirtyFields).length > 0;

  const onSubmit = async (data: AssessmentFormValues) => {
    const { setError, clearErrors } = form;
    if (data.skills.length === 0) {
      setError("skills", {
        type: "manual",
        message: "Add at least one skill to continue.",
      });
      return;
    }
    clearErrors("skills");
    setSubmitting(true);
    try {
      let skills = data.skills;
      if (isEdit) {
        const { defaultValues } = form.formState;
        const initial = defaultValues?.skills || [];
        const displayOrderId = new Map(
          data.skills.map((item, index) => [item.id, index]),
        );
        skills = [
          ...data.skills.map((item) => ({
            ...item,
            _destroy: false,
          })),
          ...initial
            .filter((item) => !displayOrderId.has(item?.id))
            .map((item) => ({
              ...item,
              _destroy: true,
              display_order: displayOrderId.get(item?.id),
            })),
        ];
      }
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: skills,
      };
      const save = isEdit
        ? () => assessmentsApi.update(Number(id), payload)
        : () => assessmentsApi.create(payload);
      const res = await save();
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      setErrorResponse(
        e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        form.reset({
          name: a.name,
          time_limit_min: a.time_limit_min,
          skills: a.skills,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, form.reset, isEdit]);

  return {
    ...form,
    onSubmit,
    submitting,
    errorResponse,
    loading,
    hasUnsavedChanges,
  };
}
