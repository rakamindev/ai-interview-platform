import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FormPageLayout from "@/components/layout/FormPageLayout";
import AssessmentForm, { type AssessmentFormValues } from "@/components/assessment/AssessmentForm";
import AssessmentFormSkeleton from "@/components/assessment/AssessmentFormSkeleton";
import { assessmentsApi } from "@/services/assessments";
import ErrorState from "@/components/feedback/ErrorState";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<AssessmentFormValues | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        setInitialValues({
          name: a.name,
          time_limit_min: a.time_limit_min,
          language: a.language ?? "en",
          skills: a.skills ?? [],
        });
      })
      // Never render the form without the saved data: submitting an empty form would overwrite it.
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, reloadKey]);

  const handleSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Add at least one skill.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AssessmentFormSkeleton />;
  }

  if (loadError || !initialValues) {
    return (
      <FormPageLayout backTo={`/assessments/${id}/invite`} backLabel="Assessment" title="Edit assessment">
        <ErrorState
          message="Couldn't load this assessment. Your saved skills and settings are unchanged. Check your connection and try again."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </FormPageLayout>
    );
  }

  return (
    <AssessmentForm
      mode="edit"
      title="Edit assessment"
      description="Update assessment details and skill requirements."
      initialValues={initialValues}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      backTo={`/assessments/${id}/invite`}
      backLabel="Assessment"
      cancelTo={`/assessments/${id}/invite`}
    />
  );
}
