
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import VacancyForm from "@/components/vacancies/VacancyForm";
import { vacanciesApi } from "@/services/vacancies";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/apiError";

import type { VacancyFormValues } from "@/components/vacancies/VacancyForm";
import type { VacancyPayload } from "@/services/vacancies";

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [initialValues, setInitialValues] =
    useState<VacancyFormValues | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadVacancy = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await vacanciesApi.get(Number(id));

        if (cancelled) return;

        const vacancy = response.data.vacancy;

        setInitialValues({
          role_title: vacancy.role_title,
          culture_dimensions: vacancy.culture_dimensions ?? "",
          competency_expectations:
            vacancy.competency_expectations ?? "",
          skills: vacancy.skills ?? [],
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

    void loadVacancy();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async (data: VacancyPayload) => {
    try {
      await vacanciesApi.update(Number(id), data);

      toast.success("Vacancy updated successfully.");

      navigate("/vacancies");
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(
          error,
          "Failed to update vacancy. Please try again."
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
            Loading vacancy...
          </p>
        </div>
      </div>
    );
  }

  if (error || !initialValues) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />

        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Unable to load vacancy
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          The vacancy could not be loaded. Please try again.
        </p>

        <Button asChild className="mt-6 rounded-xl">
          <Link to="/vacancies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Vacancies
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <VacancyForm
      mode="edit"
      initialValues={initialValues}
      onSave={handleSave}
    />
  );
}