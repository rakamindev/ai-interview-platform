import { Routes, Route, Navigate } from "react-router-dom";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
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

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
      {/* udah VVV */}
      <Route path="/login" element={<LoginPage />} />
      {/* udah VVV */}
      <Route path="/signup" element={<SignupPage />} />

      {/* Assessor routes (protected) */}
      <Route element={<ProtectedRoute />}>
      <Route element={<AssessorLayout />}>
        {/* udah VVV */}
        <Route path="/" element={<Navigate to="/assessments" replace />} />
        {/* udah VVV */}
        <Route path="/assessments" element={<AssessmentListPage />} />
        {/* udah VVV */}
        <Route path="/assessments/new" element={<AssessmentNewPage />} />
        {/* udah VVV */}
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
        {/* udah VVV */}
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        {/* udah VVV */}
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
        {/* udah VVV */}
        <Route path="/vacancies" element={<VacancyListPage />} />
        {/* udah VVV */}
        <Route path="/vacancies/new" element={<VacancyNewPage />} />
        {/* udah VVV */}
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
