import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { vacanciesApi } from "@/services/vacancies";
import { VacancyFormValues } from "../../types";

export default function useVacancy() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [errorResponse, setErrorResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isEdit = Boolean(id);

  const { control, setError, clearErrors, reset, ...rest } =
    useForm<VacancyFormValues>({
      defaultValues: {
        role_title: "",
        culture_dimensions: "",
        competency_expectations: "",
        skills: [],
      },
    });

  const hasUnsavedChanges = Object.keys(rest.formState.dirtyFields).length > 0;

  const onSubmit = async (data: VacancyFormValues) => {
    if (data.skills.length === 0) {
      setError("skills", {
        type: "manual",
        message: "At least one expected skill is required",
      });
      return;
    }

    clearErrors("skills");
    setSubmitting(true);
    try {
      let skills = data.skills;
      if (isEdit) {
        const { defaultValues } = rest.formState;
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
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: skills,
      };
      const save = isEdit
        ? () => vacanciesApi.update(Number(id), payload)
        : () => vacanciesApi.create(payload);
      await save();
      navigate("/vacancies");
    } catch (e: any) {
      setErrorResponse(
        e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // @todo: use TanStack query to avoid side-effect
  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data.vacancy;
        reset({
          role_title: v.role_title,
          culture_dimensions: v.culture_dimensions,
          competency_expectations: v.competency_expectations,
          skills: v.skills,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset, isEdit]);

  return {
    ...rest,
    reset,
    onSubmit,
    submitting,
    errorResponse,
    setError,
    clearErrors,
    control,
    loading,
    hasUnsavedChanges,
  };
}
