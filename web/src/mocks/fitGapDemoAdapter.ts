import { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import type { Assessment, AssessmentSkill } from "@/types";
import {
  demoAssessment,
  demoPortfolios,
  demoReports,
  demoSessions,
  demoVacancies,
} from "@/mocks/fitGapDemoData";

function response(config: Parameters<AxiosAdapter>[0], data: unknown, status = 200): AxiosResponse {
  const statusText = status === 201 ? "Created" : status === 404 ? "Not Found" : "OK";
  return {
    data,
    status,
    statusText,
    headers: {},
    config,
  };
}

function notFound(config: Parameters<AxiosAdapter>[0], message: string): never {
  const errorResponse = response(config, { errors: [{ message }] }, 404);
  throw new AxiosError(message, AxiosError.ERR_BAD_REQUEST, config, undefined, errorResponse);
}

function sessionPortfolio(sessionId: number) {
  return demoPortfolios[sessionId];
}

let createdSessionCount = 0;
let createdAssessmentCount = 0;
const demoAssessments: Assessment[] = [demoAssessment];

export const fitGapDemoAdapter: AxiosAdapter = async (config) => {
  const url = (config.url ?? "").split("?")[0];
  const method = (config.method ?? "get").toUpperCase();

  if (method === "GET" && url === "/assessments") {
    return response(config, {
      assessments: demoAssessments.map((assessment) => {
        const latestSession = demoSessions.find((session) => session.assessment_id === assessment.id);
        return {
          ...assessment,
          latest_session: latestSession ? { status: latestSession.status, end_reason: latestSession.end_reason } : undefined,
        };
      }),
      meta: { current_page: 1, total_pages: 1, total_count: demoAssessments.length, per_page: 20 },
    });
  }

  if (method === "POST" && url === "/assessments") {
    const payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const input = payload?.assessment ?? {};
    createdAssessmentCount += 1;
    const assessment: Assessment = {
      id: 109 + createdAssessmentCount,
      name: input.name ?? `Demo assessment ${createdAssessmentCount}`,
      time_limit_min: input.time_limit_min ?? 45,
      language: input.language ?? "en",
      skills: (input.assessment_skills_attributes ?? []).map((skill: Partial<AssessmentSkill>, index: number) => ({
        ...skill,
        id: index + 1,
        skill_label: skill.skill_label ?? `Demo skill ${index + 1}`,
        is_custom: skill.is_custom ?? false,
        expected_level: skill.expected_level ?? 3,
        display_order: index,
      })),
    };
    demoAssessments.unshift(assessment);
    return response(config, { assessment, system_prompt_generated: true }, 201);
  }

  const assessmentSessionsMatch = url.match(/^\/assessments\/(\d+)\/sessions$/);
  if (method === "GET" && assessmentSessionsMatch) {
    const assessmentId = Number(assessmentSessionsMatch[1]);
    if (!demoAssessments.some((assessment) => assessment.id === assessmentId)) {
      return response(config, notFound(config, "Demo assessment not found."));
    }
    return response(config, { sessions: demoSessions.filter((session) => session.assessment_id === assessmentId) });
  }

  const createSessionMatch = url.match(/^\/assessments\/(\d+)\/sessions$/);
  if (method === "POST" && createSessionMatch) {
    const assessmentId = Number(createSessionMatch[1]);
    if (!demoAssessments.some((assessment) => assessment.id === assessmentId)) {
      return response(config, notFound(config, "Demo assessment not found."));
    }
    const payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    createdSessionCount += 1;
    const sessionId = 510 + createdSessionCount;
    const session = {
      id: sessionId,
      assessment_id: assessmentId,
      candidate_name: payload?.session?.candidate_name ?? `Kandidat Contoh ${createdSessionCount + 3}`,
      invite_token: `demo-candidate-${createdSessionCount + 3}`,
      invite_url: `${window.location.origin}/interview/demo-candidate-${createdSessionCount + 3}`,
      status: "pending" as const,
      created_at: new Date().toISOString(),
    };
    demoSessions.unshift(session);
    return response(config, { session, invite_url: session.invite_url }, 201);
  }

  const assessmentMatch = url.match(/^\/assessments\/(\d+)$/);
  if (assessmentMatch && (method === "GET" || method === "PUT")) {
    const assessmentId = Number(assessmentMatch[1]);
    const index = demoAssessments.findIndex((assessment) => assessment.id === assessmentId);
    if (index < 0) return response(config, notFound(config, "Demo assessment not found."));
    if (method === "GET") return response(config, { assessment: demoAssessments[index] });

    const payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const input = payload?.assessment ?? {};
    const current = demoAssessments[index];
    const updated: Assessment = {
      ...current,
      name: input.name ?? current.name,
      time_limit_min: input.time_limit_min ?? current.time_limit_min,
      skills: (input.assessment_skills_attributes ?? current.skills ?? []).map((skill: Partial<AssessmentSkill>, position: number) => ({
        ...skill,
        id: skill.id ?? position + 1,
        skill_label: skill.skill_label ?? `Demo skill ${position + 1}`,
        is_custom: skill.is_custom ?? false,
        expected_level: skill.expected_level ?? 3,
        display_order: position,
      })),
    };
    demoAssessments[index] = updated;
    return response(config, { assessment: updated, system_prompt_generated: true });
  }

  if (method === "GET" && url === "/vacancies") {
    return response(config, {
      vacancies: demoVacancies,
      meta: { current_page: 1, total_pages: 1, total_count: demoVacancies.length, per_page: 20 },
    });
  }

  const vacancyMatch = url.match(/^\/vacancies\/(\d+)$/);
  if (method === "GET" && vacancyMatch) {
    const vacancy = demoVacancies.find((item) => item.id === Number(vacancyMatch[1]));
    return response(config, vacancy ? { vacancy } : notFound(config, "Demo vacancy not found."));
  }

  const sessionMatch = url.match(/^\/sessions\/(\d+)$/);
  if (method === "GET" && sessionMatch) {
    const session = demoSessions.find((item) => item.id === Number(sessionMatch[1]));
    return response(config, session
      ? { session, assessment: { id: demoAssessment.id, name: demoAssessment.name, time_limit_min: demoAssessment.time_limit_min } }
      : notFound(config, "Demo session not found."));
  }

  const portfolioMatch = url.match(/^\/sessions\/(\d+)\/portfolio$/);
  if (method === "GET" && portfolioMatch) {
    const portfolio = sessionPortfolio(Number(portfolioMatch[1]));
    return response(config, portfolio ? { portfolio } : notFound(config, "Demo portfolio not found."));
  }

  const fitGapMatch = url.match(/^\/portfolios\/(\d+)\/fitgap\/(\d+)$/);
  if (method === "GET" && fitGapMatch) {
    const report = demoReports[`${fitGapMatch[1]}:${fitGapMatch[2]}`];
    return response(config, report ? { report } : notFound(config, "Demo fit/gap report not found."));
  }

  if (method === "POST" && /^\/portfolios\/\d+\/(fitgap|regenerate_fitgap)$/.test(url)) {
    return response(config, { status: "generating", message: "Demo report generation queued." });
  }

  if (method === "GET" && /^\/portfolios\/\d+\/export$/.test(url)) {
    const format = config.params?.format;
    const data = format === "pdf"
      ? new Blob(["Demo PDF export. No real candidate data."], { type: "application/pdf" })
      : { demo: true, reports: Object.values(demoReports) };
    return response(config, data);
  }

  notFound(config, `No demo response configured for ${method} ${url}.`);
};
