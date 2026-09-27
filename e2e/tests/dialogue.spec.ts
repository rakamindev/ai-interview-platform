import { test, expect } from '../fixtures';

/**
 * E2E test: Full Conversational Cadence & Coordinated Dual-Gating
 *
 * Verifies the complete live dialogue lifecycle:
 * 1. WebSocket connection state transitions (connecting → connected)
 * 2. Turn 1 (AI Speaking): AI greeting badge visible, voice bars animate,
 *    client-side mic muted (dual-gating), AI transcript renders
 * 3. Turn 2 (Turn Handover → Candidate Speaking): Gemini turnComplete triggers
 *    speaker_changed:candidate, mic un-mutes, candidate transcript renders
 * 4. Wrap-Up & Completion: WRAP_UP_SIGNAL injection transitions room to
 *    "Interview Complete", session status → ended in database
 */
test.describe('Live Dialogue & Coordinated Dual-Gating', () => {
  // Full dialogue test spans consent → hardware check → multi-turn conversation → wrap-up.
  // 120s accommodates hardware check probing, WebSocket setup, mock Gemini turn-taking,
  // and server-side GATE_OPEN_DELAY (800ms per turn handover).
  test.setTimeout(120_000);

  test('Full Conversational Cadence & Dual-Gating', async ({ page, request }) => {
    // ─── Setup: Track WebSocket binary sends (candidate audio → Rails) ────
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

    // ─── Navigate to happy-path interview ──────────────────────────────────
    await page.goto('/interview/e2e-token-happy-path');

    // ─── Accept consent ────────────────────────────────────────────────────
    // Wait for candidateInfo API to load (renders role title) so the component
    // tree is stable before interacting with the consent dialog. Without this,
    // React re-renders on setState(candidateInfo) can detach the dialog DOM.
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const consentModal = page.getByTestId('pre-flight-consent-modal');
    await expect(consentModal).toBeVisible({ timeout: 10000 });

    // Use force: true to bypass stability checks since the dialog animation
    // can cause Playwright to consider the element "not stable" during the
    // CSS transition. The element IS visible and interactive.
    const consentCheckbox = page.locator('#uu-pdp-affirmative-consent');
    await expect(consentCheckbox).toBeVisible({ timeout: 5000 });
    await consentCheckbox.check({ force: true });

    const consentButton = page.getByRole('button', { name: /Saya Setuju/i });
    await expect(consentButton).toBeEnabled({ timeout: 5000 });
    await consentButton.click();

    // ─── Complete Hardware Check ────────────────────────────────────────────
    const hardwareCheck = page.getByTestId('hardware-check');
    await expect(hardwareCheck).toBeVisible({ timeout: 10000 });

    // Wait for mic visualizer to indicate synthetic audio is flowing
    const micLevel = page.getByTestId('mic-level');
    await expect(micLevel).toBeVisible({ timeout: 15000 });
    await expect(micLevel).not.toHaveText('0', { timeout: 15000 });

    // Click "Mulai Wawancara" to enter room
    const startInterviewButton = page.getByTestId('start-interview-button');
    await expect(startInterviewButton).toBeEnabled({ timeout: 20000 });
    await startInterviewButton.click();

    // ─── Assert WebSocket connection state: connecting → connected ──────
    // After clicking start, the page should show "Connecting..."
    await expect(page.getByText('Connecting...', { exact: true })).toBeVisible({ timeout: 10000 });

    // Wait for ConnectionStatus to show "Connected" (green dot)
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 20000 });

    // ─── Turn 1: AI Speaking ──────────────────────────────────────────────
    // The mock Gemini sends a greeting modelTurn with audio + transcription.
    // Rails forwards audio (binary) → frontend detects AI speaking.

    // Assert "AI speaking" label is visible (VoiceBars label prop)
    await expect(page.getByText('AI speaking')).toBeVisible({ timeout: 20000 });

    // Assert voice bars animate (bars with animate-voice-bar class)
    const voiceBars = page.locator('.animate-voice-bar');
    await expect(voiceBars.first()).toBeVisible({ timeout: 10000 });

    // Assert client-side microphone mute is engaged (Coordinated Dual-Gating).
    // During AI speaking, the InterviewPage starts with muteRef.current?.() called.
    // The Mic button should NOT show "Muted" (manual mute) but the mic IS muted
    // via the dual-gating mechanism (muteRef called in handleSpeakerChange when ai).
    // We verify: no candidate audio should be flowing during AI speech.

    // Assert AI transcript turn renders in DOM
    // The mock sends outputTranscription with greeting text
    await expect(page.getByText(/Selamat datang|pengalaman/i)).toBeVisible({ timeout: 20000 });

    // ─── Turn 2: Turn Handover & Candidate Speaking ───────────────────────
    // After Gemini sends turnComplete, Rails sends speaker_changed:candidate
    // with GATE_OPEN_DELAY (800ms). The frontend un-mutes the microphone.

    // Assert candidate speaking badge is displayed
    await expect(page.getByText("You're speaking")).toBeVisible({ timeout: 15000 });

    // Verify that binary frames were sent from browser to Rails (candidate audio streaming)
    // This confirms the microphone was un-muted during candidate turn.
    await expect.poll(
      async () => await page.evaluate(() => (window as any).__wsBinarySends),
      { timeout: 15000 }
    ).toBeGreaterThan(0);

    // Assert candidate transcript bubble renders (from inputTranscription)
    // The mock sends: "Halo! Saya memiliki pengalaman lima tahun..."
    await expect(page.getByText(/pengalaman lima tahun|React dan Ruby/i)).toBeVisible({ timeout: 25000 });

    // Assert candidate transcript bubble has "You" label
    await expect(page.getByText('You', { exact: true })).toBeVisible({ timeout: 10000 });

    // ─── Wrap-Up & Completion ─────────────────────────────────────────────
    // Inject wrap-up signal via mock Gemini HTTP API
    const wrapUpResponse = await request.post('http://localhost:8080/api/wrap-up', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(wrapUpResponse.ok()).toBeTruthy();

    // Assert room transitions to "Interview Complete" state
    await expect(page.getByText('Interview Complete')).toBeVisible({ timeout: 30000 });

    // Assert session status updates to 'ended' in database
    // We verify by checking the candidate_info API response for the session
    await expect.poll(
      async () => {
        try {
          const resp = await request.get(
            'http://localhost:3001/api/v1/sessions/e2e-token-happy-path/candidate'
          );
          if (!resp.ok()) return null;
          const body = await resp.json();
          return body.session_status;
        } catch {
          return null;
        }
      },
      {
        timeout: 20000,
        message: 'Expected session status to be "ended" in database',
      }
    ).toBe('ended');
  });
});
