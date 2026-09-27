import { test as base, expect } from '@playwright/test';

type TestFixtures = {
  fakeAudioRouting: void;
};

/**
 * Extended Playwright test runner with synthetic media device routing.
 * Ensures navigator.mediaDevices.getUserMedia binds directly to Chromium's
 * synthetic fake audio input device without blocking on macOS CoreAudio defaults.
 */
export const test = base.extend<TestFixtures>({
  fakeAudioRouting: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getUserMedia = async (constraints) => {
            if (constraints && constraints.audio) {
              try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const fakeAudio = devices.find(
                  (d) => d.kind === 'audioinput' && d.deviceId !== 'default'
                );
                if (fakeAudio) {
                  const audioConstraints =
                    typeof constraints.audio === 'object' ? { ...constraints.audio } : {};
                  if (!audioConstraints.deviceId) {
                    audioConstraints.deviceId = { exact: fakeAudio.deviceId };
                  }
                  constraints = { ...constraints, audio: audioConstraints };
                }
              } catch (e) {
                console.warn('[E2E] Failed to route fake audio device:', e);
              }
            }
            return origGUM(constraints);
          };
        }
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
