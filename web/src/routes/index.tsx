import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import PrivateLayout from "@/components/layout/private";
import CandidateLayout from "@/components/layout/CandidateLayout";
import LoadingState from "@/components/shared/loading-state";

// Lazy-loaded pages
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));

const AssessmentListPage = lazy(
  () => import("@/features/assessments/pages/AssessmentListPage")
);
const AssessmentNewPage = lazy(
  () => import("@/features/assessments/pages/AssessmentNewPage")
);
const AssessmentEditPage = lazy(
  () => import("@/features/assessments/pages/AssessmentEditPage")
);
const AssessmentInvitePage = lazy(
  () => import("@/features/assessments/pages/AssessmentInvitePage")
);

const VacancyListPage = lazy(
  () => import("@/features/vacancies/pages/VacancyListPage")
);
const VacancyNewPage = lazy(
  () => import("@/features/vacancies/pages/VacancyNewPage")
);
const VacancyEditPage = lazy(
  () => import("@/features/vacancies/pages/VacancyEditPage")
);

const PortfolioPage = lazy(
  () => import("@/features/evaluation/pages/PortfolioPage")
);
const FitGapReportPage = lazy(
  () => import("@/features/evaluation/pages/FitGapReportPage")
);
const LiveMonitorPage = lazy(
  () => import("@/features/evaluation/pages/LiveMonitorPage")
);
const TranscriptPage = lazy(
  () => import("@/features/evaluation/pages/TranscriptPage")
);

const InterviewPage = lazy(
  () => import("@/features/interview/pages/InterviewPage")
);

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingState variant="centered" message="Loading..." />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PageSuspense>
            <LoginPage />
          </PageSuspense>
        }
      />
      <Route path="/signup" element={<Navigate to="/login" replace />} />

      {/* Protected Assessor Routes (with PrivateLayout: collapsible sidebar, navbar, breadcrumbs) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<PrivateLayout />}>
          <Route path="/" element={<Navigate to="/assessments" replace />} />
          <Route
            path="/assessments"
            element={
              <PageSuspense>
                <AssessmentListPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/new"
            element={
              <PageSuspense>
                <AssessmentNewPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/edit"
            element={
              <PageSuspense>
                <AssessmentEditPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/invite"
            element={
              <PageSuspense>
                <AssessmentInvitePage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/monitor"
            element={
              <PageSuspense>
                <LiveMonitorPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={
              <PageSuspense>
                <PortfolioPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/transcript"
            element={
              <PageSuspense>
                <TranscriptPage />
              </PageSuspense>
            }
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={
              <PageSuspense>
                <FitGapReportPage />
              </PageSuspense>
            }
          />
          <Route
            path="/vacancies"
            element={
              <PageSuspense>
                <VacancyListPage />
              </PageSuspense>
            }
          />
          <Route
            path="/vacancies/new"
            element={
              <PageSuspense>
                <VacancyNewPage />
              </PageSuspense>
            }
          />
          <Route
            path="/vacancies/:id/edit"
            element={
              <PageSuspense>
                <VacancyEditPage />
              </PageSuspense>
            }
          />
        </Route>
      </Route>

      {/* Public Candidate Interview Route */}
      <Route element={<CandidateLayout />}>
        <Route
          path="/interview/:token"
          element={
            <PageSuspense>
              <InterviewPage />
            </PageSuspense>
          }
        />
      </Route>
    </Routes>
  );
}
