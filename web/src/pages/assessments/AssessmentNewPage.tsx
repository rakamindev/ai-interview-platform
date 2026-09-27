
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import AssessmentForm from "@/components/assessment/AssessmentForm";
import { assessmentsApi } from "@/services/assessments";
import { getApiErrorMessage } from "@/utils/apiError";

import type { AssessmentFormValues } from "@/components/assessment/AssessmentForm";
import type { AssessmentPayload } from "@/services/assessments";

export type { AssessmentFormValues };

export default function AssessmentNewPage() {
  const navigate = useNavigate();

  const handleSave = async (data: AssessmentPayload) => {
    try {
      const response = await assessmentsApi.create(data);

      toast.success(
        "Assessment created successfully. You can now invite candidates."
      );

      navigate(
        `/assessments/${response.data.assessment.id}/invite`
      );
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(
          error,
          "Failed to create assessment. Please try again."
        )
      );

      throw error;
    }
  };

  return (
    <AssessmentForm
      mode="create"
      onSave={handleSave}
    />
  );
}