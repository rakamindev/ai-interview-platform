import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { AUTH_DIR, SEED_FILE, STATE_FILE, signIn, findSeed, warmUp } from "./session";

// Signs in once for the whole run, and looks up the seeded IDs once. The API allows five logins a minute from one
// address (Rack::Attack), so signing in per test would be throttled.
export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel } = config.projects[0].use;
  const browser = await chromium.launch({ channel });
  const page = await browser.newPage({ baseURL });
  page.setDefaultNavigationTimeout(90_000);
  try {
    const token = await signIn(page);
    const seed = await findSeed(page, token);
    await warmUp(page, token, seed);
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await page.context().storageState({ path: STATE_FILE });
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
  } finally {
    await browser.close();
  }
}
