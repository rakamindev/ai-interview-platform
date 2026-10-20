const SILENCE_THRESHOLD = 0.01; // RMS below this = silence
const SILENCE_FRAMES_BEFORE_SKIP = 8; // ~50ms of silence before we stop sending

// How often the measured level is reported to the page.
//
// process() runs once per 128-sample quantum — about 125 times a second at
// 16 kHz. A UI does not need that resolution, and posting every quantum would
// put 125 messages a second through the port for no benefit.
const LEVEL_REPORT_EVERY = 32;

// How long the input must be ENTIRELY ABSENT before the page is told.
//
// Deliberately far longer than any pause. A candidate who is thinking still
// delivers samples we can measure, so a quiet moment is never mistaken for a
// microphone that has stopped providing data — which is exactly the
// difference between "we can't hear you" and crying wolf every few seconds.
const NO_INPUT_SECONDS = 4;

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._silentFrames = 0;

    // process() runs once per 128-sample render quantum. The rate is read
    // defensively so that a scope without it still counts frames as if 16kHz,
    // instead of yielding NaN, failing every comparison, and silently never
    // warning anyone — a missing warning is the failure this exists to fix.
    const rate = typeof sampleRate === "number" && sampleRate > 0 ? sampleRate : 16000;
    this._noInputFramesNeeded = Math.max(1, Math.round((NO_INPUT_SECONDS * rate) / 128));
    this._absentFrames = 0;
    this._reportingNoInput = false;
  }

  process(inputs) {
    const input = inputs[0];
    const hasInput = !!(input && input[0] && input[0].length > 0);

    if (!hasInput) {
      // No data at all: the track ended, the device changed, or permission was
      // withdrawn. This branch used to fall through without a word, which is
      // how a candidate whose hardware check had just passed could spend the
      // rest of the interview unheard and never be told why.
      this._absentFrames += 1;
      if (!this._reportingNoInput && this._absentFrames >= this._noInputFramesNeeded) {
        this._reportingNoInput = true;
        this.port.postMessage({ type: "no_input" });
      }
      return true;
    }

    this._absentFrames = 0;
    if (this._reportingNoInput) {
      this._reportingNoInput = false;
      this.port.postMessage({ type: "input_restored" });
    }

    const samples = input[0];

    // Compute RMS
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);

    // A muted microphone, or the wrong input device, keeps delivering samples
    // — they are simply silent. The track never ends, so neither the 'ended'
    // event nor the 'mute' event above ever fires. Reporting the level is what
    // lets the page tell "no sound" apart from "no track": the two look the
    // same to a listener, but they need different advice.
    this._levelFrames = (this._levelFrames || 0) + 1;
    if (this._levelFrames >= LEVEL_REPORT_EVERY) {
      this._levelFrames = 0;
      this.port.postMessage({ type: "level", rms });
    }

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
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
