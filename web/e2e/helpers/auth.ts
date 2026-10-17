import { Page } from "@playwright/test";

const rawHeader = '{"alg":"HS256"}';
const rawPayload = '{"user_id":1,"role":"admin","scheme":"test-corp","exp":1792322294}';
const signature = "KGc9U2v86JMrIG5jH5ut1N-UFxjV7fgo6Qi9i8abSgE";
export const TEST_TOKEN = `${Buffer.from(rawHeader).toString("base64url")}.${Buffer.from(rawPayload).toString("base64url")}.${signature}`;

export async function loginAsAssessor(page: Page) {
  // Pre-seed the localStorage auth token to avoid flaky network wait in beforeEach
  await page.addInitScript((token) => {
    localStorage.setItem("auth_token", token);
  }, TEST_TOKEN);
}

export async function createCandidateSession(candidateName = "E2E Test Candidate"): Promise<string> {
  const res = await fetch("http://localhost:3001/api/v1/assessments/2/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TEST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidate_name: candidateName }),
  });
  const data = await res.json();
  return data.session.invite_token;
}
