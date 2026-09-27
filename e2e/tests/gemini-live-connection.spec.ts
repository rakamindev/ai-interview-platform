import { test, expect } from '../fixtures';

/**
 * E2E test: Gemini Live model validity gate.
 *
 * Reproduces the "reconnecting… then Interview Complete, no audio" bug a
 * candidate hits when the platform is configured with a deprecated Gemini Live
 * model (e.g. gemini-2.0-flash-live-001). Real Gemini rejects that model at
 * setup with close code 1008; the mock mirrors that rejection.
 *
 * The test asserts the CORRECT behaviour — that the AI greeting turn appears —
 * so it is RED against a stale model config and GREEN once GEMINI_LIVE_MODEL is
 * a supported value (gemini-3.1-flash-live-preview).
 */
test.describe('Gemini Live connection', () => {
  test.setTimeout(120_000);

  test('AI greeting appears when the live model is supported', async ({ page }) => {
    await page.goto('/interview/e2e-token-model-validity');

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

    // ─── Complete Hardware Check ────────────────────────────────────────────
    const hardwareCheck = page.getByTestId('hardware-check');
    await expect(hardwareCheck).toBeVisible({ timeout: 10000 });
    const micLevel = page.getByTestId('mic-level');
    await expect(micLevel).toBeVisible({ timeout: 15000 });
    await expect(micLevel).not.toHaveText('0', { timeout: 15000 });
    const startInterviewButton = page.getByTestId('start-interview-button');
    await expect(startInterviewButton).toBeEnabled({ timeout: 20000 });
    await startInterviewButton.click();

    // ─── The AI greeting turn MUST render ──────────────────────────────────
    // This only happens if the Gemini connection was accepted (supported model).
    // With a stale model, the mock closes the socket with 1008, Rails retries 3×,
    // marks the session end_reason=error, and the room collapses into
    // "Interview Complete" with no transcript — so this assertion goes red.
    await expect(page.getByText(/Selamat datang|pengalaman/i)).toBeVisible({ timeout: 20000 });
  });
});
