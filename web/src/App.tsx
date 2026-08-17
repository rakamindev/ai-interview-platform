import { Routes, Route, Navigate, useParams } from "react-router-dom";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import InterviewPage from "@/pages/interview/InterviewPage";
import FeedbackPage from "@/pages/feedback/FeedbackPage";
import ComparisonPage from "@/pages/comparison/ComparisonPage";
import NotFoundPage from "@/pages/not-found/NotFoundPage";

function AssessmentRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/assessments/${id}/invite`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Assessor routes (protected) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AssessorLayout />}>
          <Route path="/" element={<Navigate to="/assessments" replace />} />
          <Route path="/assessments" element={<AssessmentListPage />} />
          <Route path="/assessments/new" element={<AssessmentNewPage />} />
          <Route path="/assessments/:id" element={<AssessmentRedirect />} />
          <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
          <Route
            path="/assessments/:id/sessions/:sessionId/monitor"
            element={<LiveMonitorPage />}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/transcript"
            element={<TranscriptPage />}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={<FitGapReportPage />}
          />
          <Route path="/assessments/:id/comparison" element={<ComparisonPage />} />
          <Route path="/vacancies" element={<VacancyListPage />} />
          <Route path="/vacancies/new" element={<VacancyNewPage />} />
          <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
        </Route>
      </Route>

      {/* Candidate routes (public) */}
      <Route element={<CandidateLayout />}>
        <Route path="/interview/:token" element={<InterviewPage />} />
        <Route path="/feedback/:token" element={<FeedbackPage />} />
      </Route>

      {/* Fallback 404 route for unmatched paths */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
