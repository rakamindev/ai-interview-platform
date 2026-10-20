import { Routes, Route, Navigate } from "react-router-dom";
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
import SettingsPage from "@/pages/settings/SettingsPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import SkillsPage from "@/pages/skills/SkillsPage";
import InterviewPage from "@/pages/interview/InterviewPage";

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
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      </Route>

      {/* Candidate route (public) */}
      <Route element={<CandidateLayout />}>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Route>
    </Routes>
  );
}
