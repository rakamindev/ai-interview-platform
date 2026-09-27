import { test, expect } from '../fixtures';

test.describe('Pre-Flight Onboarding and UU PDP Consent Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Track getUserMedia calls and AudioContext instances
    await page.addInitScript(() => {
      (window as any).__gumCalls = 0;
      (window as any).__audioContexts = [];

      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (...args) => {
          (window as any).__gumCalls++;
          return origGUM(...args);
        };
      }

      const OrigAudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (OrigAudioContext) {
        window.AudioContext = class extends OrigAudioContext {
          constructor(...args: any[]) {
            super(...args);
            (window as any).__audioContexts.push(this);
          }
        };
      }
    });
  });

  test('Scenario 1: UU PDP Consent Opt-Out terminates cleanly without capturing microphone', async ({ page }) => {
    // Navigate to interview with consent decline scenario token
    await page.goto('/interview/e2e-token-consent-decline');

    // Assert Pre-Flight Consent Modal is visible with UU PDP statutory notice
    const consentModal = page.getByTestId('pre-flight-consent-modal');
    await expect(consentModal).toBeVisible();
    await expect(consentModal).toContainText(/UU PDP|Undang-Undang.*27.*2022/i);
    await expect(consentModal).toContainText(/data biometrik|biometrik suara/i);

    // Decline consent
    const declineButton = page.getByRole('button', { name: /Tolak/i });
    await expect(declineButton).toBeVisible();
    await declineButton.click();

    // Assert modal closes and informative decline message is displayed
    await expect(consentModal).not.toBeVisible();
    await expect(page.getByText(/Consent Declined|Persetujuan Ditolak/i)).toBeVisible();
    await expect(page.getByText(/UU PDP No\. 27\/2022/i)).toBeVisible();
    await expect(page.getByText(/recruiter|perekrut/i)).toBeVisible();

    // Verify microphone hardware was never accessed
    const gumCalls = await page.evaluate(() => (window as any).__gumCalls);
    expect(gumCalls).toBe(0);
  });

  test('Scenario 2: Affirmative Consent & Hardware Check with Soft Bypass activates live audio on user gesture', async ({ page }) => {
    // Simulate advisory connectivity warning (mock latency > 300ms)
    await page.route('**/health', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    // Navigate to interview with soft bypass scenario token
    await page.goto('/interview/e2e-token-soft-bypass');

    // Assert Pre-Flight Consent Modal is visible
    const consentModal = page.getByTestId('pre-flight-consent-modal');
    await expect(consentModal).toBeVisible();

    // Affirmative Opt-In: check consent checkbox and click "Saya Setuju"
    const consentCheckbox = page.locator('#uu-pdp-affirmative-consent');
    await consentCheckbox.check();

    const consentButton = page.getByRole('button', { name: /Saya Setuju/i });
    await expect(consentButton).toBeEnabled();
    await consentButton.click();

    // Assert transition to Hardware Check
    const hardwareCheck = page.getByTestId('hardware-check');
    await expect(hardwareCheck).toBeVisible();

    // Assert synthetic microphone audio level registers on visualizer
    const visualizer = page.getByTestId('mic-visualizer');
    await expect(visualizer).toBeVisible({ timeout: 10000 });

    const micLevel = page.getByTestId('mic-level');
    await expect(micLevel).toBeVisible();
    // Synthetic audio device produces non-zero volume
    await expect(micLevel).not.toHaveText('0', { timeout: 10000 });

    // Assert Soft Bypass confirmation button appears due to advisory latency (>300ms)
    const softBypassButton = page.getByTestId('soft-bypass-button');
    await expect(softBypassButton).toBeVisible({ timeout: 10000 });

    // Assert Start Interview button is initially disabled due to failed advisory check
    const startInterviewButton = page.getByTestId('start-interview-button');
    await expect(startInterviewButton).toBeDisabled();

    // Click Soft Bypass to confirm proceeding
    await softBypassButton.click();
    await expect(page.getByText(/Soft Bypass Enabled/i)).toBeVisible();

    // Start Interview button is now enabled
    await expect(startInterviewButton).toBeEnabled();

    // Click "Mulai Wawancara" (Start Interview) button
    await startInterviewButton.click();

    // Assert transition to active/connecting interview room
    await expect(page.getByText('Connecting...', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /End Interview/i })).toBeVisible({ timeout: 10000 });

    // Assert audio capture and playback contexts are activated within the user gesture
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const contexts = ((window as any).__audioContexts || []) as AudioContext[];
        return contexts
          .filter((ctx) => ctx.state !== 'closed')
          .map((ctx) => ({
            sampleRate: ctx.sampleRate,
            state: ctx.state,
          }));
      });
    }, { timeout: 10000 }).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sampleRate: 16000, state: 'running' }),
        expect.objectContaining({ sampleRate: 24000, state: 'running' }),
      ])
    );
  });
});
