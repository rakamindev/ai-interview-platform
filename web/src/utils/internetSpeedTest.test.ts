import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS } from './internetSpeedTest';

describe('Internet Speed Test & Voice Streaming Thresholds', () => {
  it('has calibrated realistic thresholds suitable for 16kHz PCM audio streaming in Indonesia', () => {
    // PCM 16kHz 16-bit mono = 256 kbps (0.25 Mbps)
    // 1.0 Mbps upload gives a 4x safety margin without unfairly disqualifying mobile users
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBe(1.0);
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBe(2.0);
    expect(DEFAULT_THRESHOLDS.maxPingMs).toBe(300);
  });

  it('correctly evaluates connection pass status based on calibrated thresholds', () => {
    const evaluatesPass = (
      download: number,
      upload: number,
      ping: number,
      thresholds = DEFAULT_THRESHOLDS
    ) => {
      return (
        download >= thresholds.minDownloadMbps &&
        upload >= thresholds.minUploadMbps &&
        ping <= thresholds.maxPingMs
      );
    };

    // Candidate on 4G cellular with 2.5 Mbps down, 1.2 Mbps up, 85ms ping
    expect(evaluatesPass(2.5, 1.2, 85)).toBe(true);

    // Candidate with insufficient upload (< 1.0 Mbps)
    expect(evaluatesPass(3.0, 0.7, 90)).toBe(false);

    // Candidate with excessive ping (> 300ms)
    expect(evaluatesPass(5.0, 2.0, 380)).toBe(false);

    // Candidate with insufficient download (< 2.0 Mbps)
    expect(evaluatesPass(1.2, 2.0, 100)).toBe(false);
  });
});
