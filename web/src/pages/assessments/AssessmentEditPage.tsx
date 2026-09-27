
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import AssessmentForm from "@/components/assessment/AssessmentForm";
import { assessmentsApi } from "@/services/assessments";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/apiError";

import type { AssessmentFormValues } from "@/components/assessment/AssessmentForm";
import type { AssessmentPayload } from "@/services/assessments";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [initialValues, setInitialValues] =
    useState<AssessmentFormValues | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAssessment = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await assessmentsApi.get(Number(id));

        if (cancelled) return;

        const assessment = response.data.assessment;

        setInitialValues({
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          language: assessment.language ?? "en",
          skills: assessment.skills ?? [],
        });
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async (data: AssessmentPayload) => {
    try {
      await assessmentsApi.update(Number(id), data);

      toast.success("Assessment updated successfully.");

      navigate(`/assessments/${id}/invite`);
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(
          error,
          "Failed to update assessment. Please try again."
        )
      );

      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />

          <p className="mt-4 text-sm text-slate-500">
            Loading assessment...
          </p>
        </div>
      </div>
    );
  }

  if (error || !initialValues) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Unable to Load Assessment
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          The assessment could not be loaded. Please return
          to the assessment list and try again.
        </p>

        <Button asChild className="mt-6 rounded-xl">
          <Link to="/assessments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assessments
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <AssessmentForm
      mode="edit"
      initialValues={initialValues}
      onSave={handleSave}
      cancelHref={`/assessments/${id}/invite`}
    />
  );
}