import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageErrorBoundary from "@/components/PageErrorBoundary";

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

function PageWrap({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <PageErrorBoundary pageName={name}>
      <Suspense fallback={<RouteLoadingFallback />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<PageWrap name="Login"><LoginPage /></PageWrap>} />

      {/* Assessor routes (protected) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AssessorLayout />}>
          <Route path="/" element={<Navigate to="/assessments" replace />} />
          <Route path="/assessments" element={<PageWrap name="Assessments"><AssessmentListPage /></PageWrap>} />
          <Route path="/assessments/new" element={<PageWrap name="New Assessment"><AssessmentNewPage /></PageWrap>} />
          <Route path="/assessments/:id/edit" element={<PageWrap name="Edit Assessment"><AssessmentEditPage /></PageWrap>} />
          <Route path="/assessments/:id/invite" element={<PageWrap name="Assessment Sessions"><AssessmentInvitePage /></PageWrap>} />
          <Route
            path="/assessments/:id/sessions/:sessionId/monitor"
            element={<PageWrap name="Live Monitor"><LiveMonitorPage /></PageWrap>}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PageWrap name="Portfolio"><PortfolioPage /></PageWrap>}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/transcript"
            element={<PageWrap name="Transcript"><TranscriptPage /></PageWrap>}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={<PageWrap name="Fit/Gap Analysis"><FitGapReportPage /></PageWrap>}
          />
          <Route path="/vacancies" element={<PageWrap name="Vacancies"><VacancyListPage /></PageWrap>} />
          <Route path="/vacancies/new" element={<PageWrap name="New Vacancy"><VacancyNewPage /></PageWrap>} />
          <Route path="/vacancies/:id/edit" element={<PageWrap name="Edit Vacancy"><VacancyEditPage /></PageWrap>} />
        </Route>
      </Route>

      {/* Candidate route (public) */}
      <Route element={<CandidateLayout />}>
        <Route path="/interview/:token" element={<PageWrap name="Interview"><InterviewPage /></PageWrap>} />
      </Route>
    </Routes>
  );
}
