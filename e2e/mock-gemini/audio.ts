/**
 * Generates synthetic 24kHz PCM 16-bit mono little-endian audio.
 * Gemini Live model outputs 24kHz PCM.
 *
 * @param durationMs Duration of generated audio in milliseconds (default: 200ms)
 * @param sampleRate Sample rate in Hz (default: 24000)
 * @param frequency Tone frequency in Hz (default: 440)
 */
export function generateSyntheticPcm(
  durationMs: number = 200,
  sampleRate: number = 24000,
  frequency: number = 440
): Buffer {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Moderate amplitude to avoid clipping: ~20% of max 32767
    const sample = Math.round(Math.sin(2 * Math.PI * frequency * t) * 6000);
    buffer.writeInt16LE(sample, i * 2);
  }

  return buffer;
}

/**
 * Returns base64 encoded synthetic 24kHz PCM audio for Gemini modelTurn parts.
 */
export function generateSyntheticAudioBase64(
  durationMs: number = 200,
  sampleRate: number = 24000,
  frequency: number = 440
): string {
  const pcm = generateSyntheticPcm(durationMs, sampleRate, frequency);
  return pcm.toString('base64');
}
