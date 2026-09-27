
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import VacancyForm from "@/components/vacancies/VacancyForm";
import { vacanciesApi } from "@/services/vacancies";
import { getApiErrorMessage } from "@/utils/apiError";

import type { VacancyPayload } from "@/services/vacancies";

export default function VacancyNewPage() {
  const navigate = useNavigate();

  const handleSave = async (data: VacancyPayload) => {
    try {
      await vacanciesApi.create(data);

      toast.success("Vacancy created successfully.");

      navigate("/vacancies");
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        "Failed to create vacancy. Please try again."
      );

      toast.error(message);

      throw error;
    }
  };

  return (
    <VacancyForm
      mode="create"
      onSave={handleSave}
    />
  );
}