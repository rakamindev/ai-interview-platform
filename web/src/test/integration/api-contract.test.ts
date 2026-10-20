// @vitest-environment-options { "url": "http://localhost:5173/" }
//
// The web app's real services against the real, running Rails API: real HTTP,
// a real CORS preflight from the web app's origin, real JSON. It checks that
// what the API returns has the fields and types the screens read.
//
// Opt-in, because it needs the API running and writes to its database:
//   API_INTEGRATION_URL=http://localhost:3001/api/v1 \
//   API_INTEGRATION_EMAIL=admin@example.com API_INTEGRATION_PASSWORD=... npm test
// Run it from the host: inside the web container the API sees the Host "api", which
// Rails' development host authorization blocks with a 403.
//
// It only creates records it can delete again (an assessment without sessions,
// and a vacancy) and deletes them at the end. It never starts or ends a session,
// which would queue a model call on the dev Sidekiq.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { server } from "../server";
import api from "@/services/api";
import { authApi } from "@/services/auth";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { sessionsApi } from "@/services/sessions";
import { saveToken } from "@/stores/authAtom";

// Vitest exposes the process environment on import.meta.env.
const BASE: string | undefined = import.meta.env.API_INTEGRATION_URL;
const EMAIL: string | undefined = import.meta.env.API_INTEGRATION_EMAIL;
const PASSWORD: string | undefined = import.meta.env.API_INTEGRATION_PASSWORD;
const enabled = Boolean(BASE && EMAIL && PASSWORD);

const stamp = `Integration check ${new Date().toISOString()}`;
const anchors = { l1_anchor: "Needs guidance.", l2_anchor: "Routine scope.", l3_anchor: "Handles ambiguity.",
                  l4_anchor: "Sets standards.", l5_anchor: "Shapes the org." };
const created: { assessment?: number; vacancy?: number } = {};
let token = "";

describe.skipIf(!enabled)("web services against the running API", () => {
  beforeAll(async () => {
    api.defaults.baseURL = BASE;
    server.use(http.all(`${new URL(BASE!).origin}/*`, () => passthrough()));

    const res = await authApi.login({ email: EMAIL!, password: PASSWORD! });
    token = res.data.token;
  });

  // The global setup resets handlers after each test; let real requests through again.
  beforeEach(() => {
    server.use(http.all(`${new URL(BASE!).origin}/*`, () => passthrough()));
    saveToken(token);
  });

  afterAll(async () => {
    server.use(http.all(`${new URL(BASE!).origin}/*`, () => passthrough()));
    saveToken(token);
    if (created.assessment) await assessmentsApi.delete(created.assessment);
    if (created.vacancy) await vacanciesApi.delete(created.vacancy);
  });

  it("signs in and gets a token", () => {
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("creates an assessment and reads it back with the fields the edit screen uses", async () => {
    const res = await assessmentsApi.create({
      name: stamp, time_limit_min: 30, language: "id",
      assessment_skills_attributes: [
        { skill_label: "React", skill_id: "SK-ENG-001" as unknown as number, expected_level: 3, display_order: 0, is_custom: false, ...anchors },
      ],
    });
    created.assessment = res.data.assessment.id;

    const { assessment } = (await assessmentsApi.get(created.assessment)).data;

    expect(assessment).toMatchObject({ id: created.assessment, name: stamp, time_limit_min: 30, language: "id" });
    expect(assessment.skills).toHaveLength(1);
    expect(assessment.skills![0]).toMatchObject({ skill_label: "React", expected_level: 3, display_order: 0, ...anchors });
  });

  it("lists assessments with the paging metadata and latest-session field the list reads", async () => {
    const { assessments, meta } = (await assessmentsApi.list()).data;

    expect(meta).toEqual({
      current_page: 1, total_pages: expect.any(Number), total_count: expect.any(Number), per_page: expect.any(Number),
    });
    const mine = assessments.find((a) => a.id === created.assessment);
    expect(mine).toMatchObject({ name: stamp, time_limit_min: 30 });
    expect(mine).toHaveProperty("latest_session", null);
  });

  it("refuses an invalid assessment with a message the form can show", async () => {
    await expect(assessmentsApi.create({ name: "", time_limit_min: 15, assessment_skills_attributes: [] }))
      .rejects.toMatchObject({ response: { status: 422, data: { errors: [{ message: expect.any(String) }] } } });
  });

  it("creates a vacancy with skills whose expected levels are numbers", async () => {
    const res = await vacanciesApi.create({
      role_title: stamp, culture_dimensions: "ownership", competency_expectations: "",
      vacancy_skills_attributes: [{ skill_label: "React", expected_level: 3 }],
    });
    created.vacancy = res.data.vacancy.id;

    const { vacancy } = (await vacanciesApi.get(created.vacancy)).data;

    expect(vacancy.role_title).toBe(stamp);
    expect(vacancy.skills[0]).toMatchObject({ skill_label: "React", expected_level: 3 });
  });

  it("serves the skill taxonomy with five anchors per skill", async () => {
    const { skill_taxonomies } = (await skillTaxonomiesApi.list()).data;

    expect(skill_taxonomies.length).toBeGreaterThan(0);
    expect(skill_taxonomies[0]).toMatchObject({
      skill_id: expect.any(String), skill_label: expect.any(String),
      l1_anchor: expect.any(String), l5_anchor: expect.any(String),
    });
  });

  it("answers an unknown invite link with a 404 the candidate page can read", async () => {
    await expect(sessionsApi.getCandidateInfo("not-a-real-token"))
      .rejects.toMatchObject({ response: { status: 404, data: { errors: [{ message: expect.any(String) }] } } });
  });
});
