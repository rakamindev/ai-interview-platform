import React from "react";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

export const useAssessmentListPage = () => {
  const [assessments, setAssessments] = React.useState<Assessment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const getAssessments = React.useCallback(() => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    getAssessments();
  }, []);

  return { assessments, loading, error, getAssessments };
}