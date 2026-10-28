import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Built production UI, isolated synthetic HTTP responses; no keys, real API, or microphone.
const server = await preview({ configFile: false, envDir: false, preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const folder = '../assessment/evidence/reload-ui';
await mkdir(folder, { recursive: true });
let mode = 'failed';
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/sessions/synthetic/candidate')) {
      if (mode === 'load_error') return route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });
      return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { session_id: 123, role_title: 'Synthetic interview', time_limit_min: 45, session_status: 'ended', end_reason: mode === 'complete' ? 'manual_candidate' : 'error', remaining_seconds: 0 } }) });
    }
    if (url.origin !== origin) throw new Error('Unexpected external request blocked: ' + url.origin);
    return route.continue();
  });
  for (const [state, heading, width] of [['failed', 'Interview interrupted', 1280], ['failed', 'Interview interrupted', 390], ['load_error', 'Unable to load interview', 390], ['complete', 'Interview Complete', 390]]) {
    mode = state; await page.setViewportSize({ width, height: 850 });
    await page.goto(origin + '/interview/synthetic');
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Interview Complete', exact: true }).count(), state === 'complete' ? 1 : 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    await page.screenshot({ path: `${folder}/${state}-${width}.png`, fullPage: true });
  }
  console.log(JSON.stringify({ result: 'PASS', ui: 'built production InterviewPage', cases: ['ended/error', 'load failure', 'normal completion'], viewports: [1280,390], horizontalOverflow: false, credentialsLoaded: false, realApiCalled: false, microphoneUsed: false }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
