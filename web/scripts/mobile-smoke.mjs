import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright';

// Built UI only. All API/speed requests and media/WS inputs are synthetic.
const phase = process.argv.includes('--before') ? 'before' : 'after';
const folder = `../assessment/evidence/mobile-${phase}`;
await mkdir(folder, { recursive: true });
const server = await preview({ configFile: false, envDir: false, preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const longSkill = 'FrontendArchitectureAndAccessibleDataVisualization'.repeat(2);
const portfolio = { id: 123, session_id: 123, generation_status: 'complete', generation_error: null, overrides: [], skills: [{ id: 1, skill_id: 'synthetic', skill_label: longSkill, is_discovered: false, ai_level: 1, ai_confidence: 'low', evidence: ['Synthetic evidence: compared render scheduling and accessibility tradeoffs. '.repeat(4), 'componentIdentifier'.repeat(8)], competency_summary: 'Synthetic summary for responsive review. '.repeat(8) }] };
const report = { id: 1, portfolio_id: 123, vacancy_id: 1, skill_comparisons: [{ skill_label: longSkill, expected_level: 3, candidate_level: 1, result: 'gap', delta: -2, confidence: 'low' }], culture_narrative: null, overall_narrative: 'Synthetic fit/gap narrative for a long-content layout check. '.repeat(5) };
const rows = [], unknown = [], errors = [];
const speedHosts = new Set(['www.google.com', 'cdn.jsdelivr.net', 'unpkg.com', 'httpbin.org', 'www.httpbin.org', 'postman-echo.com']);
try {
  for (const width of [360, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    await context.addInitScript(() => {
      localStorage.setItem('auth_token', 'synthetic-placeholder');
      window.fixtureMicAllowed = false;
      navigator.mediaDevices.getUserMedia = async () => {
        if (!window.fixtureMicAllowed) throw new DOMException('Synthetic permission denial', 'NotAllowedError');
        const ctx = new AudioContext({ sampleRate: 16000 });
        const oscillator = ctx.createOscillator(), destination = ctx.createMediaStreamDestination();
        oscillator.connect(destination); oscillator.start(); await ctx.resume();
        return destination.stream;
      };
      class FixtureSocket {
        static OPEN = 1;
        readyState = 0;
        constructor() {
          setTimeout(() => {
            this.readyState = 1; this.onopen?.();
            for (const msg of [{ type: 'session_started' }, { type: 'transcript', speaker: 'ai', text: 'Synthetic question about frontend architecture and accessibility.' }, { type: 'transcript', speaker: 'candidate', text: 'Synthetic answer with an identifier: ' + 'componentIdentifier'.repeat(8) }, { type: 'speaker_changed', speaker: 'candidate' }]) this.onmessage?.({ data: JSON.stringify(msg) });
          }, 30);
        }
        send(data) {
          if (typeof data === 'string' && JSON.parse(data).type === 'end_session') this.onmessage?.({ data: JSON.stringify({ type: 'session_ended', reason: 'manual_candidate' }) });
        }
        close() { this.readyState = 3; this.onclose?.(); }
      }
      window.WebSocket = FixtureSocket;
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      let data;
      if (url.pathname.endsWith('/sessions/synthetic/candidate')) data = { session_id: 123, role_title: 'Senior Frontend Engineer - Accessible Data Visualization Platform', time_limit_min: 45, session_status: 'pending', remaining_seconds: 2700 };
      else if (url.pathname.endsWith('/sessions/123/portfolio')) data = { portfolio };
      else if (url.pathname.endsWith('/sessions/123')) data = { session: { id: 123, candidate_name: 'Synthetic Candidate With A Long Display Name For Layout Verification' } };
      else if (url.pathname.endsWith('/vacancies')) data = { vacancies: [{ id: 1, role_title: 'Synthetic vacancy with long role requirements', skills: [] }] };
      else if (url.pathname.endsWith('/portfolios/123/fitgap/1')) data = { report };
      else if (url.pathname.endsWith('/portfolios/123/export')) data = { portfolio, fit_gap_report: report };
      else if (speedHosts.has(url.hostname)) {
        await new Promise(resolve => setTimeout(resolve, 25));
        return route.fulfill({ status: 200, headers, body: 'synthetic speed fixture' });
      } else if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      else { unknown.push(url.origin + url.pathname); return route.abort('blockedbyclient'); }
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ data }) });
    });
    async function record(state, controls = []) {
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('header, main, h1, button, table')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, text: e.textContent?.slice(0, 55), right: Math.round(e.getBoundingClientRect().right) })).slice(0, 10) }));
      const inaccessible = [];
      for (const name of controls) {
        const control = page.getByRole('button', { name, exact: true });
        const rect = await control.boundingBox();
        if (!rect || rect.x < -1 || rect.x + rect.width > width + 1) inaccessible.push(name);
      }
      await page.screenshot({ path: `${folder}/${state}-${width}.png`, fullPage: true });
      rows.push({ state, width, ...dimensions, inaccessible, pass: dimensions.document <= width + 1 && inaccessible.length === 0 });
    }
    await page.goto(origin + '/interview/synthetic');
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    if (width === 390) await page.screenshot({ path: `${folder}/microphone-failed-390.png`, fullPage: true });
    await page.evaluate(() => { window.fixtureMicAllowed = true; });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Start Interview' && !b.disabled));
    await record('precheck', ['Start Interview']);
    await page.getByRole('button', { name: 'Start Interview', exact: true }).click();
    await page.getByRole('button', { name: 'End Interview', exact: true }).waitFor();
    await page.getByText(/Synthetic answer with an identifier/).waitFor();
    await record('interview', ['Mic On', 'End Interview']);
    await page.getByRole('button', { name: 'Mic On', exact: true }).click();
    await page.getByRole('button', { name: 'Muted', exact: true }).waitFor();
    await page.getByRole('button', { name: 'End Interview', exact: true }).click();
    await page.getByRole('button', { name: 'End interview', exact: true }).click();
    await page.getByRole('heading', { name: 'Interview Complete', exact: true }).waitFor();
    await page.goto(origin + '/assessments/1/sessions/123/portfolio');
    await page.getByRole('heading', { name: 'Configured Skills', exact: true }).waitFor();
    await record('portfolio', ['PDF', 'JSON']);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON', exact: true }).click(); await downloaded;
    await page.goto(origin + '/assessments/1/sessions/123/fitgap/1');
    await page.getByText('Skill Comparison', { exact: true }).waitFor();
    await record('fitgap', ['Regenerate', 'PDF', 'JSON']);
    await page.locator('table').evaluate(table => { table.parentElement.scrollLeft = table.parentElement.scrollWidth; });
    const lastCellRight = await page.locator('th').last().evaluate(cell => cell.getBoundingClientRect().right);
    rows[rows.length - 1].tableResultReachable = lastCellRight <= width + 1;
    rows[rows.length - 1].pass &&= lastCellRight <= width + 1;
    await context.close();
  }
  const summary = { phase, result: rows.every(r => r.pass) && !unknown.length && !errors.length ? 'PASS' : 'FAIL', browser: 'Edge Chromium viewport emulation', widths: [360,390,768,1280], cases: rows, unknownRequests: unknown, pageErrors: errors, fixtures: true, envLoaded: false, realApiCalled: false, realMicrophoneUsed: false, realGeminiUsed: false, autoplayOverrideForLayout: true };
  await writeFile(`${folder}/results.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(unknown.length, 0, 'Incomplete network fixture');
  assert.equal(errors.length, 0, 'Unexpected browser error');
  assert.ok(rows.every(r => r.pass), 'Viewport overflow or inaccessible controls detected');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
