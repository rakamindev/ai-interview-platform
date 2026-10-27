import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VacancyForm, { type VacancyFormValues } from "@/components/vacancies/VacancyForm";
import VacancyFormSkeleton from "@/components/vacancies/VacancyFormSkeleton";
import { vacanciesApi } from "@/services/vacancies";

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<VacancyFormValues | null>(null);

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data.vacancy;
        setInitialValues({
          role_title: v.role_title,
          culture_dimensions: v.culture_dimensions ?? "",
          competency_expectations: v.competency_expectations ?? "",
          skills: v.skills ?? [],
        });
      })
      .catch(() => {
        setError("Failed to load vacancy data. Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to update vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <VacancyFormSkeleton />;
  }

  return (
    <VacancyForm
      mode="edit"
      title="Edit vacancy"
      description="Update role requirements and skill benchmarks for this vacancy."
      initialValues={initialValues ?? undefined}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    />
  );
}
