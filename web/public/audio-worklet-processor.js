const SILENCE_THRESHOLD = 0.01; // RMS below this = silence
const SILENCE_FRAMES_BEFORE_SKIP = 8; // ~50ms of silence before we stop sending

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._silentFrames = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const samples = input[0];

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);

      if (rms < SILENCE_THRESHOLD) {
        this._silentFrames++;
        if (this._silentFrames < SILENCE_FRAMES_BEFORE_SKIP) {
          // Send a few silent frames so Gemini VAD gets a clean tail
          const pcm16 = new Int16Array(samples.length);
          this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
        }
        // After threshold, skip sending until sound resumes
        return true;
      }

      this._silentFrames = 0;
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
