const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 1024; // ~64ms of 16kHz mono audio (2048 bytes PCM16)
const SILENCE_THRESHOLD = 0.0012; // Sensitive RMS threshold to preserve quiet consonants
const SILENCE_CHUNKS_BEFORE_SKIP = 24; // ~1.5s grace window of silence before pausing stream

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(BUFFER_SIZE);
    this._bufferIndex = 0;
    this._silentChunks = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const rawSamples = input[0];
    const sourceSampleRate = typeof sampleRate !== "undefined" ? sampleRate : TARGET_SAMPLE_RATE;

    if (sourceSampleRate === TARGET_SAMPLE_RATE) {
      this._appendSamples(rawSamples);
    } else {
      const resampled = this._resample(rawSamples, sourceSampleRate, TARGET_SAMPLE_RATE);
      this._appendSamples(resampled);
    }

    return true;
  }

  _appendSamples(samples) {
    let offset = 0;
    while (offset < samples.length) {
      const needed = BUFFER_SIZE - this._bufferIndex;
      const toCopy = Math.min(needed, samples.length - offset);

      this._buffer.set(samples.subarray(offset, offset + toCopy), this._bufferIndex);
      this._bufferIndex += toCopy;
      offset += toCopy;

      if (this._bufferIndex >= BUFFER_SIZE) {
        this._dispatchChunk(this._buffer);
        this._bufferIndex = 0;
      }
    }
  }

  _dispatchChunk(samples) {
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / samples.length);

    if (rms < SILENCE_THRESHOLD) {
      this._silentChunks++;
      if (this._silentChunks <= SILENCE_CHUNKS_BEFORE_SKIP) {
        // Send clean silent frame during intra-sentence pauses so Gemini VAD retains a smooth baseline
        const pcm16 = new Int16Array(samples.length);
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      }
      return;
    }

    // Active speech detected — reset silence hold counter
    this._silentChunks = 0;
    const pcm16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
  }

  _resample(input, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const outLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outLength);

    for (let i = 0; i < outLength; i++) {
      const srcIndex = i * ratio;
      const idx0 = Math.floor(srcIndex);
      const idx1 = Math.min(idx0 + 1, input.length - 1);
      const frac = srcIndex - idx0;
      output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
    }

    return output;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
