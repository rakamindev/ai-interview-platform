import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PageSkeleton, { PageHeaderSkeleton } from "@/components/layout/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";

const LiveMonitorPage = lazy(() => import("@/pages/monitor/LiveMonitorPage"));
const InterviewPage = lazy(() => import("@/pages/interview/InterviewPage"));

/** Shown while a lazily loaded page's code downloads. */
function PageLoadingFallback() {
  return (
    <PageSkeleton label="page">
      <PageHeaderSkeleton />
      <Skeleton className="h-48 w-full" />
    </PageSkeleton>
  );
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
          <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
          <Route
            path="/assessments/:id/sessions/:sessionId/monitor"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <LiveMonitorPage />
              </Suspense>
            }
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
        <Route
          path="/interview/:token"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <InterviewPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
