import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { performRefresh } from "@/services/api";
import { Toaster } from "@/components/ui/sonner";
import AssessorLayout from "@/components/layout/AssessorLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import LoginPage from "@/pages/auth/LoginPage";
import AcceptInvitePage from "@/pages/auth/AcceptInvitePage";
import InviteAdminPage from "@/pages/admin/InviteAdminPage";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import BulkInvitePage from "@/pages/assessments/BulkInvitePage";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import InterviewPage from "@/pages/interview/InterviewPage";
import OverrideHistoryPage from "@/pages/audit/OverrideHistoryPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await performRefresh();
      } catch {
        // Refresh failed - user will be redirected to login by ProtectedRoute
      } finally {
        setIsAuthReady(true);
      }
    };
    initAuth();
  }, []);

  return (
    <>
      <Toaster />
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        {/* Deprecated: SignupPage — replaced by admin-invite flow (WEB-NEW-01).
          Remove once no external links reference /signup. */}

        {/* Assessor routes (protected) */}
        <Route element={<ProtectedRoute isAuthReady={isAuthReady} requiredRole="assessor" />}>
          <Route element={<AssessorLayout />}>
            <Route path="/" element={<Navigate to="/assessments" replace />} />
            <Route element={<ProtectedRoute isAuthReady={isAuthReady} requiredRole="admin" />}>
              <Route
                path="/admin/invite"
                element={
                  <RouteErrorBoundary routeName="admin-invite">
                    <InviteAdminPage />
                  </RouteErrorBoundary>
                }
              />
            </Route>
            <Route
              path="/audit/overrides"
              element={
                <RouteErrorBoundary routeName="audit-overrides">
                  <OverrideHistoryPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments"
              element={
                <RouteErrorBoundary routeName="assessments">
                  <AssessmentListPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/new"
              element={
                <RouteErrorBoundary routeName="assessment-new">
                  <AssessmentNewPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/edit"
              element={
                <RouteErrorBoundary routeName="assessment-edit">
                  <AssessmentEditPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/invite"
              element={
                <RouteErrorBoundary routeName="assessment-invite">
                  <AssessmentInvitePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/bulk-invite"
              element={
                <RouteErrorBoundary routeName="bulk-invite">
                  <BulkInvitePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/sessions/:sessionId/monitor"
              element={
                <RouteErrorBoundary routeName="monitor">
                  <LiveMonitorPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/sessions/:sessionId/portfolio"
              element={
                <RouteErrorBoundary routeName="portfolio">
                  <PortfolioPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/sessions/:sessionId/transcript"
              element={
                <RouteErrorBoundary routeName="transcript">
                  <TranscriptPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={
                <RouteErrorBoundary routeName="fitgap">
                  <FitGapReportPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/vacancies"
              element={
                <RouteErrorBoundary routeName="vacancies">
                  <VacancyListPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/vacancies/new"
              element={
                <RouteErrorBoundary routeName="vacancy-new">
                  <VacancyNewPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/vacancies/:id/edit"
              element={
                <RouteErrorBoundary routeName="vacancy-edit">
                  <VacancyEditPage />
                </RouteErrorBoundary>
              }
            />
          </Route>
        </Route>

        {/* Candidate route (public) */}
        <Route element={<CandidateLayout />}>
          <Route
            path="/interview/:token"
            element={
              <RouteErrorBoundary routeName="interview" showSessionRecovery>
                <InterviewPage />
              </RouteErrorBoundary>
            }
          />
        </Route>

        {/* Catch-all: no route matched */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
