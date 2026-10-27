import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AssessmentForm, { type AssessmentFormValues } from "@/components/assessment/AssessmentForm";
import { assessmentsApi } from "@/services/assessments";

export type { AssessmentFormValues };

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Add at least one skill to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AssessmentForm
      mode="create"
      title="New assessment"
      description="Configure interview skills and time limits for candidates."
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      cancelTo="/assessments"
    />
  );
}
