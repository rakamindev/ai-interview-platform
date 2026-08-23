const SILENCE_THRESHOLD = 0.01; // RMS below this = silence

class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const samples = input[0];

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);

      // Stream continuously — even below threshold — so the backend/Gemini
      // VAD sees an unbroken stream instead of the pauses inherent to
      // natural speech being spliced out.
      const pcm16 = new Int16Array(samples.length);
      if (rms >= SILENCE_THRESHOLD) {
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          pcm16[i] = s < 0 ? s * 32768 : s * 32767;
        }
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
