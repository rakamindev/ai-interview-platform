import { Routes, Route, Navigate } from "react-router-dom";
import AssessorLayout from "./layouts/AssessorLayout";
import CandidateLayout from "./layouts/CandidateLayout";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "@/features/auth/pages/LoginPage";
import AssessmentListPage from "@/features/assessments/pages/AssessmentListPage";
import AssessmentNewPage from "@/features/assessments/pages/AssessmentNewPage";
import AssessmentEditPage from "@/features/assessments/pages/AssessmentEditPage";
import AssessmentInvitePage from "@/features/assessments/pages/AssessmentInvitePage";
import LiveMonitorPage from "@/features/monitor/pages/LiveMonitorPage";
import PortfolioPage from "@/features/portfolio/pages/PortfolioPage";
import FitGapReportPage from "@/features/fitgap/pages/FitGapReportPage";
import TranscriptPage from "@/features/transcript/pages/TranscriptPage";
import VacancyListPage from "@/features/vacancies/pages/VacancyListPage";
import VacancyNewPage from "@/features/vacancies/pages/VacancyNewPage";
import VacancyEditPage from "@/features/vacancies/pages/VacancyEditPage";
import InterviewPage from "@/features/interview/pages/InterviewPage";

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
        <Route path="/vacancies" element={<VacancyListPage />} />
        <Route path="/vacancies/new" element={<VacancyNewPage />} />
        <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
      </Route>
      </Route>

      {/* Candidate route (public) */}
      <Route element={<CandidateLayout />}>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Route>
    </Routes>
  );
}
