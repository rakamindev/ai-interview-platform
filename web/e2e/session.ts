import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

// What `rails e2e:seed` created, looked up by name through the real API, so the tests don't depend on IDs.
export interface Seed {
  assessmentId: number;
  vacancyId: number;
  sessions: Record<string, number>;
}

// Written once by global-setup.ts, read by every test. Gitignored: the state holds a signed-in token.
export const AUTH_DIR = fileURLToPath(new URL("./.auth/", import.meta.url));
export const STATE_FILE = `${AUTH_DIR}state.json`;
export const SEED_FILE = `${AUTH_DIR}seed.json`;

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001/api/v1";
const ASSESSMENT = "E2E Senior Frontend Engineer";
const VACANCY = "E2E Frontend Engineer";

function credentials() {
  const email = process.env.E2E_EMAIL ?? "admin@example.com";
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error("Set E2E_PASSWORD to the seeded admin's password (DEV_ADMIN_PASSWORD) first");
  return { email, password };
}

/** Signs in through the real login page and returns the token the app stored. */
export async function signIn(page: Page): Promise<string> {
  const { email, password } = credentials();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/assessments");
  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  if (!token) throw new Error("Signed in, but the app stored no token");
  return token;
}

export async function findSeed(page: Page, token: string): Promise<Seed> {
  const get = async (url: string) => {
    const res = await page.request.get(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok()) throw new Error(`GET ${url} answered ${res.status()}`);
    return res.json();
  };

  const assessment = (await get("/assessments")).assessments.find((a: { name: string }) => a.name === ASSESSMENT);
  const vacancy = (await get("/vacancies")).vacancies.find((v: { role_title: string }) => v.role_title === VACANCY);
  if (!assessment || !vacancy) throw new Error("No E2E data for this login's company: run `rails e2e:seed` first");

  const sessions: Record<string, number> = {};
  for (const s of (await get(`/assessments/${assessment.id}/sessions`)).sessions) sessions[s.candidate_name] = s.id;
  return { assessmentId: assessment.id, vacancyId: vacancy.id, sessions };
}

/**
 * Calls each endpoint the pages read once, before any test runs. The API in development loads code on its first
 * request to each controller, which can outlast a test's wait; this keeps that cost out of the tests.
 */
export async function warmUp(page: Page, token: string, seed: Seed) {
  const headers = { Authorization: `Bearer ${token}` };
  const sessionId = seed.sessions["E2E Mixed"];
  const portfolio = await page.request.get(`${API_URL}/sessions/${sessionId}/portfolio`, { headers, timeout: 90_000 });
  const portfolioId = (await portfolio.json()).portfolio?.id;
  await page.request.get(`${API_URL}/sessions/${sessionId}`, { headers, timeout: 90_000 });
  if (portfolioId) {
    await page.request.get(`${API_URL}/portfolios/${portfolioId}/fitgap/${seed.vacancyId}`, { headers, timeout: 90_000 });
  }
}
