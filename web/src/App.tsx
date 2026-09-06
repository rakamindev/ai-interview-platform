import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const AssessmentListPage = lazy(() => import("@/pages/assessments/AssessmentListPage"));
const AssessmentNewPage = lazy(() => import("@/pages/assessments/AssessmentNewPage"));
const AssessmentEditPage = lazy(() => import("@/pages/assessments/AssessmentEditPage"));
const AssessmentInvitePage = lazy(() => import("@/pages/assessments/AssessmentInvitePage"));
const LiveMonitorPage = lazy(() => import("@/pages/monitor/LiveMonitorPage"));
const PortfolioPage = lazy(() => import("@/pages/portfolio/PortfolioPage"));
const FitGapReportPage = lazy(() => import("@/pages/fitgap/FitGapReportPage"));
const TranscriptPage = lazy(() => import("@/pages/transcript/TranscriptPage"));
const VacancyListPage = lazy(() => import("@/pages/vacancies/VacancyListPage"));
const VacancyNewPage = lazy(() => import("@/pages/vacancies/VacancyNewPage"));
const VacancyEditPage = lazy(() => import("@/pages/vacancies/VacancyEditPage"));
const InterviewPage = lazy(() => import("@/pages/interview/InterviewPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
    </Suspense>
  );
}
