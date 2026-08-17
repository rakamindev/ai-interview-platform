import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandedSkeleton from "@/components/layout/BrandedSkeleton";

const AssessorLayout = lazy(() => import("@/components/layout/AssessorLayout"));
const CandidateLayout = lazy(() => import("@/components/layout/CandidateLayout"));
const ProtectedRoute = lazy(() => import("@/components/ProtectedRoute"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const SignupPage = lazy(() => import("@/pages/auth/SignupPage"));
const AccessDeniedPage = lazy(() => import("@/pages/auth/AccessDeniedPage"));
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

function SessionExpiredHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onSessionExpired = () => {
      if (location.pathname === "/login") return;
      void navigate("/login", { replace: true, state: { sessionExpired: true } });
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => window.removeEventListener("auth:session-expired", onSessionExpired);
  }, [navigate, location.pathname]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<BrandedSkeleton />}>
      <SessionExpiredHandler />
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />

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
