import { test, expect } from '../fixtures';

/**
 * E2E test: Live Gemini smoke (on-demand).
 *
 * Runs the full candidate journey against Google's *real* Gemini Live API
 * (not the mock) to verify protocol compatibility before a release. Invoked via
 * `GEMINI_API_KEY=<valid-key> npm run test:live`; skips gracefully when no key
 * is present.
 *
 * Tagged @live so it can be selected with `--grep @live` and is not part of the
 * deterministic mock-mode suite.
 */
const LIVE = !!process.env.GEMINI_API_KEY;

test.describe('Live Gemini smoke', { tag: '@live' }, () => {
  test.skip(!LIVE, 'GEMINI_API_KEY not set — skipping live Gemini smoke test');
  // Real Gemini can take 10-30s to produce the first spoken turn.
  test.setTimeout(180_000);

  test('candidate journey completes against real Gemini Live', async ({ page }) => {
    // Track binary frames (candidate audio → Rails) to prove mic streaming.
    await page.addInitScript(() => {
      (window as any).__wsBinarySends = 0;
      const OrigWebSocket = window.WebSocket;
      window.WebSocket = class extends OrigWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
        }
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
          if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            (window as any).__wsBinarySends++;
          }
          return super.send(data);
        }
      };
    });

    // ─── Navigate to the live-Gemini reserved session ──────────────────────
    await page.goto('/interview/e2e-token-live-gemini');

    // ─── Accept consent ────────────────────────────────────────────────────
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    const consentModal = page.getByTestId('pre-flight-consent-modal');
    await expect(consentModal).toBeVisible({ timeout: 10000 });
    const consentCheckbox = page.locator('#uu-pdp-affirmative-consent');
    await expect(consentCheckbox).toBeVisible({ timeout: 5000 });
    await consentCheckbox.check({ force: true });
    const consentButton = page.getByRole('button', { name: /Saya Setuju/i });
    await expect(consentButton).toBeEnabled({ timeout: 5000 });
    await consentButton.click();

    // ─── Complete hardware check ────────────────────────────────────────────
    const hardwareCheck = page.getByTestId('hardware-check');
    await expect(hardwareCheck).toBeVisible({ timeout: 10000 });
    const micLevel = page.getByTestId('mic-level');
    await expect(micLevel).toBeVisible({ timeout: 15000 });
    await expect(micLevel).not.toHaveText('0', { timeout: 15000 });
    const startInterviewButton = page.getByTestId('start-interview-button');
    await expect(startInterviewButton).toBeEnabled({ timeout: 20000 });
    await startInterviewButton.click();

    // ─── Milestone 1: WebSocket connects to the real Gemini service ────────
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });

    // ─── Milestone 2: initial AI spoken greeting arrives (voice bars animate)
    await expect(page.getByText('AI speaking')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.animate-voice-bar').first()).toBeVisible({ timeout: 10000 });

    // ─── Milestone 3: non-empty AI transcript turn renders in DOM ──────────
    // TranscriptBubble renders an "AI" speaker label only for a non-empty turn.
    await expect(page.getByText('AI', { exact: true }).first()).toBeVisible({ timeout: 60000 });

    // ─── Milestone 4: candidate synthetic audio streams without disconnect ─
    // After Gemini's first turn completes, the backend hands over to the
    // candidate and un-mutes the mic; the fake device streams PCM frames.
    await expect.poll(
      async () => await page.evaluate(() => (window as any).__wsBinarySends),
      { timeout: 60000 }
    ).toBeGreaterThan(0);

    // ─── Milestone 5: clean shutdown via manual end ────────────────────────
    await page.getByRole('button', { name: 'End Interview', exact: true }).click();
    await page.getByRole('button', { name: 'End interview', exact: true }).click();
    await expect(page.getByText('Interview Complete')).toBeVisible({ timeout: 30000 });
  });
});
