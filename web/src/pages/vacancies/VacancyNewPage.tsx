import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VacancyForm, { type VacancyFormValues } from "@/components/vacancies/VacancyForm";
import { vacanciesApi } from "@/services/vacancies";

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VacancyForm
      mode="create"
      title="New vacancy"
      description="Create a vacancy benchmark with required skills and culture expectations."
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    />
  );
}
