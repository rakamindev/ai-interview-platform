import { test, expect } from '../fixtures';

/**
 * E2E Test Suite: Network Disconnect & Session Resumption (Issue 06)
 *
 * Verifies resilience against network interruptions and browser reloads:
 * 1. Scenario 1: Browser Page Reload Mid-Interview
 *    - Completes pre-flight and starts interview.
 *    - Receives Session Resumption Token during Turn 1.
 *    - Reloads page (`page.reload()`).
 *    - Re-fetches candidate info with `session_status: "active"`.
 *    - Reconnects WebSocket with stored Session Resumption Token.
 *    - Resumes conversation without resetting turn count or re-prompting hardware check.
 * 2. Scenario 2: Client Network Blip & Exponential Backoff
 *    - Toggles Playwright offline mode (`context.setOffline(true)`).
 *    - Asserts "Menghubungkan kembali..." status in UI.
 *    - Asserts audio capture is temporarily muted to avoid buffer overflow.
 *    - Restores network (`context.setOffline(false)`).
 *    - Asserts reconnection succeeds within backoff window ([1000, 2000, 4000]ms).
 *    - Asserts "Terhubung kembali" banner appears briefly.
 */
test.describe('Network Disconnect & Session Resumption', () => {
  test.setTimeout(120_000);

  test('Full Session Resumption & Network Blip Backoff Lifecycle', async ({ page, context }) => {
    // ─── Setup: Track WebSocket binary sends and connection metadata ───────
    await page.addInitScript(() => {
      (window as any).__wsBinarySends = 0;
      (window as any).__wsConnectionUrls = [];
      const OrigWebSocket = window.WebSocket;
      window.WebSocket = class extends OrigWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          (window as any).__wsConnectionUrls.push(url.toString());
        }
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
          if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            (window as any).__wsBinarySends++;
          }
          return super.send(data);
        }
      };
    });

    // ────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Browser Page Reload Mid-Interview
    // ────────────────────────────────────────────────────────────────────────

    // 1. Navigate to /interview/e2e-token-resumption
    await page.goto('/interview/e2e-token-resumption');

    // 2. Complete Pre-Flight: Affirmative Consent
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    const consentModal = page.getByTestId('pre-flight-consent-modal');
    await expect(consentModal).toBeVisible({ timeout: 10000 });

    const consentCheckbox = page.locator('#uu-pdp-affirmative-consent');
    await expect(consentCheckbox).toBeVisible({ timeout: 5000 });
    await consentCheckbox.check({ force: true });

    const consentButton = page.getByRole('button', { name: /Saya Setuju/i });
    await expect(consentButton).toBeEnabled({ timeout: 5000 });
    await consentButton.click();

    // 3. Complete Pre-Flight: Hardware Check
    const hardwareCheck = page.getByTestId('hardware-check');
    await expect(hardwareCheck).toBeVisible({ timeout: 10000 });

    const micLevel = page.getByTestId('mic-level');
    await expect(micLevel).toBeVisible({ timeout: 15000 });
    await expect(micLevel).not.toHaveText('0', { timeout: 15000 });

    const startInterviewButton = page.getByTestId('start-interview-button');
    await expect(startInterviewButton).toBeEnabled({ timeout: 20000 });
    await startInterviewButton.click();

    // 4. Assert initial WebSocket connection
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 20000 });

    // 5. Wait for AI to emit initial turn (greeting) and receive Session Resumption Token
    await expect(page.getByText(/Selamat datang|pengalaman/i)).toBeVisible({ timeout: 25000 });

    // Verify Session Resumption Token received by client and persisted in sessionStorage
    await expect.poll(
      async () => {
        return await page.evaluate(() => {
          return (
            sessionStorage.getItem('resumption_token_e2e-token-resumption') ||
            (window as any).__latestResumptionToken ||
            null
          );
        });
      },
      {
        timeout: 15000,
        message: 'Expected Session Resumption Token to be received by client',
      }
    ).toBeTruthy();

    const storedToken = await page.evaluate(
      () =>
        sessionStorage.getItem('resumption_token_e2e-token-resumption') ||
        (window as any).__latestResumptionToken
    );
    expect(storedToken).toContain('mock-resumption-handle');

    // 6. Trigger page reload mid-interview
    const candidateInfoResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/candidate') && resp.status() === 200
    );
    await page.reload();

    // 7. Assert candidate info re-fetches and detects active session (session_status: "active")
    const candidateInfoResp = await candidateInfoResponsePromise;
    const candidateData = await candidateInfoResp.json();
    expect(candidateData.session_status).toBe('active');
    expect(candidateData.resumption_token).toBeTruthy();

    // 8. Assert conversation resumes WITHOUT re-prompting for consent or hardware check
    await expect(page.getByTestId('pre-flight-consent-modal')).not.toBeVisible();
    await expect(page.getByTestId('hardware-check')).not.toBeVisible();

    // 9. Assert client reconnects WebSocket with the stored Session Resumption Token
    await expect.poll(
      async () => {
        return await page.evaluate(() => (window as any).__lastConnectedResumptionToken);
      },
      {
        timeout: 20000,
        message: 'Expected WebSocket to reconnect with stored Session Resumption Token',
      }
    ).toBeTruthy();

    const reconnectedToken = await page.evaluate(
      () => (window as any).__lastConnectedResumptionToken
    );
    expect(reconnectedToken).toContain('mock-resumption-handle');

    // 10. Assert conversation resumes without resetting turn count
    // Turn 1 transcript (AI greeting) is restored from server transcript history
    await expect(page.getByText(/Selamat datang|pengalaman/i)).toBeVisible({ timeout: 15000 });

    // Assert candidate speaking state is active (or AI finishes turn)
    await expect(page.getByText("You're speaking")).toBeVisible({ timeout: 20000 });

    // Assert audio streaming resumed (binary sends > 0)
    await expect.poll(
      async () => await page.evaluate(() => (window as any).__wsBinarySends),
      { timeout: 15000 }
    ).toBeGreaterThan(0);

    // Assert candidate transcript bubble renders
    await expect(
      page.getByText(/pengalaman lima tahun|React dan Ruby/i)
    ).toBeVisible({ timeout: 25000 });

    // Assert AI follow-up turn renders
    await expect(
      page.getByText(/scalable dan reliabel|arsitektur/i)
    ).toBeVisible({ timeout: 25000 });

    // ────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Client Network Blip & Exponential Backoff
    // ────────────────────────────────────────────────────────────────────────

    // 1. In active interview, toggle Playwright offline mode
    await context.setOffline(true);

    // 2. Assert "Menghubungkan kembali..." (Reconnecting) status appears in UI
    await expect(page.getByText(/Menghubungkan kembali/i).first()).toBeVisible({ timeout: 10000 });

    // 3. Assert audio input is temporarily muted to avoid buffer overflow
    const isMutedDuringReconnect = await page.evaluate(
      () => (window as any).__audioMutedDuringReconnect
    );
    expect(isMutedDuringReconnect).toBe(true);

    const sendsBeforeBlip = await page.evaluate(() => (window as any).__wsBinarySends);
    await page.waitForTimeout(600);
    const sendsDuringBlip = await page.evaluate(() => (window as any).__wsBinarySends);
    // While offline and muted, no new frames should be transmitted to the closed socket
    expect(sendsDuringBlip).toBe(sendsBeforeBlip);

    // 4. Toggle network back online
    const reconnectStartTime = Date.now();
    await context.setOffline(false);

    // 5. Assert reconnection succeeds within backoff window ([1000, 2000, 4000]ms)
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15000 });
    const elapsedReconnectMs = Date.now() - reconnectStartTime;
    // Reconnection should occur after initial 1000ms backoff and safely within 8000ms
    expect(elapsedReconnectMs).toBeLessThanOrEqual(8000);

    // 6. Assert "Terhubung kembali" (Reconnected) banner appears briefly
    const reconnectedBanner = page.getByTestId('reconnected-banner');
    await expect(reconnectedBanner).toBeVisible({ timeout: 5000 });
    await expect(reconnectedBanner).toContainText(/Terhubung kembali|Reconnected/i);

    // Assert banner auto-dismisses briefly after display
    await expect(reconnectedBanner).not.toBeVisible({ timeout: 8000 });
  });
});
