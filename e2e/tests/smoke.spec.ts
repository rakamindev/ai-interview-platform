import { test, expect } from '../fixtures';

test.describe('E2E Environment Smoke Test', () => {
  test('launches Chromium and grants microphone permissions without prompts', async ({ page }) => {
    // Navigate to /login to ensure Vite web server is responsive and page is stable
    await page.goto('/login');

    // Verify microphone permission state query returns granted
    const permissionStatus = await page.evaluate(async () => {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state;
      } catch {
        return 'unsupported';
      }
    });
    expect(['granted', 'unsupported']).toContain(permissionStatus);

    // Acquire synthetic audio stream; fake device flag should supply simulated audio without user prompts
    const audioStreamInfo = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      const track = tracks[0];

      const info = {
        trackCount: tracks.length,
        kind: track ? track.kind : null,
        enabled: track ? track.enabled : false,
        readyState: track ? track.readyState : null,
        muted: track ? track.muted : true,
      };

      // Stop tracks to release resources
      tracks.forEach((t) => t.stop());
      return info;
    });

    expect(audioStreamInfo.trackCount).toBeGreaterThan(0);
    expect(audioStreamInfo.kind).toBe('audio');
    expect(audioStreamInfo.enabled).toBe(true);
    expect(audioStreamInfo.readyState).toBe('live');
  });
});
