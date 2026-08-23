import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

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

const pageTitles = [
    { pattern: /^\/login$/, title: "Login" },
    { pattern: /^\/assessments$/, title: "Assessments" },
    { pattern: /^\/assessments\/new$/, title: "New Assessment" },
    { pattern: /^\/assessments\/[^/]+\/edit$/, title: "Edit Assessment" },
    { pattern: /^\/assessments\/[^/]+\/invite$/, title: "Invite Candidates" },
    {
        pattern: /^\/assessments\/[^/]+\/sessions\/[^/]+\/monitor$/,
        title: "Live Monitor",
    },
    {
        pattern: /^\/assessments\/[^/]+\/sessions\/[^/]+\/portfolio$/,
        title: "Portfolio",
    },
    {
        pattern: /^\/assessments\/[^/]+\/sessions\/[^/]+\/transcript$/,
        title: "Transcript",
    },
    {
        pattern: /^\/assessments\/[^/]+\/sessions\/[^/]+\/fitgap\/[^/]+$/,
        title: "Fit Gap Report",
    },
    { pattern: /^\/vacancies$/, title: "Vacancies" },
    { pattern: /^\/vacancies\/new$/, title: "New Vacancy" },
    { pattern: /^\/vacancies\/[^/]+\/edit$/, title: "Edit Vacancy" },
    { pattern: /^\/interview\/[^/]+$/, title: "Interview" },
];

function PageTitle() {
    const { pathname } = useLocation();

    useEffect(() => {
        const match = pageTitles.find(({ pattern }) =>
            pattern.test(pathname)
        );

        document.title = match
            ? `${match.title} | Rakamin`
            : "Rakamin";
    }, [pathname]);

    return null;
}

export default function App() {
    return (
        <>
            <PageTitle />

            <Routes>
                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />

                {/* Assessor routes (protected) */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<AssessorLayout />}>
                        <Route
                            path="/"
                            element={
                                <Navigate
                                    to="/assessments"
                                    replace
                                />
                            }
                        />

                        <Route
                            path="/assessments"
                            element={<AssessmentListPage />}
                        />

                        <Route
                            path="/assessments/new"
                            element={<AssessmentNewPage />}
                        />

                        <Route
                            path="/assessments/:id/edit"
                            element={<AssessmentEditPage />}
                        />

                        <Route
                            path="/assessments/:id/invite"
                            element={<AssessmentInvitePage />}
                        />

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

                        <Route
                            path="/vacancies"
                            element={<VacancyListPage />}
                        />

                        <Route
                            path="/vacancies/new"
                            element={<VacancyNewPage />}
                        />

                        <Route
                            path="/vacancies/:id/edit"
                            element={<VacancyEditPage />}
                        />
                    </Route>
                </Route>

                {/* Candidate route (public) */}
                <Route element={<CandidateLayout />}>
                    <Route
                        path="/interview/:token"
                        element={<InterviewPage />}
                    />
                </Route>
            </Routes>
        </>
    );
}