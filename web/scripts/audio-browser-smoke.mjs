import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

// Real Web Audio and the production hooks, with an oscillator standing in for the microphone.
// The isolated server does not load .env, contact the API, or request microphone permission.
const fixture = `
import React from '/node_modules/.vite-audio-smoke/deps/react.js';
import ReactDOM from '/node_modules/.vite-audio-smoke/deps/react-dom_client.js';
const { createRoot } = ReactDOM;
import { useAudioCapture } from '/src/hooks/useAudioCapture.ts';
import { useAudioPlayback } from '/src/hooks/useAudioPlayback.ts';
const stats = window.audioStats = { frames: 0, peak: 0, playbackEnded: false, drained: false, error: null };
let syntheticContext;
navigator.mediaDevices.getUserMedia = async () => {
  syntheticContext = new AudioContext({ sampleRate: 16000 });
  const oscillator = syntheticContext.createOscillator();
  const gain = syntheticContext.createGain();
  const destination = syntheticContext.createMediaStreamDestination();
  oscillator.frequency.value = 440;
  gain.gain.value = 0.1;
  oscillator.connect(gain).connect(destination);
  oscillator.start();
  await syntheticContext.resume();
  return destination.stream;
};
const createSource = AudioContext.prototype.createBufferSource;
AudioContext.prototype.createBufferSource = function () {
  const source = createSource.call(this);
  source.addEventListener('ended', () => { stats.playbackEnded = true; });
  return source;
};
function Harness() {
  const capture = useAudioCapture({
    onFrame: (frame) => {
      stats.frames++;
      for (const sample of new Int16Array(frame)) stats.peak = Math.max(stats.peak, Math.abs(sample));
    },
    onError: (error) => { stats.error = error.message; },
  });
  const playback = useAudioPlayback();
  window.audioControls = {
    mute: capture.mute,
    unmute: capture.unmute,
    play: async () => {
      const pcm = new Int16Array(7200);
      for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i * Math.PI * 2 * 440 / 24000) * 4000;
      await playback.playChunk(pcm.buffer);
      playback.scheduleAfterPlayback(() => { stats.drained = true; });
    },
    stop: async () => { capture.stop(); playback.stop(); await syntheticContext?.close(); },
  };
  return React.createElement('button', { onClick: async () => {
    try {
      const [, started] = await Promise.all([playback.prepare(), capture.start()]);
      if (!started) stats.error = 'Capture did not start';
    } catch (error) { stats.error = error.message; }
  } }, 'Start synthetic audio');
}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
`;

const server = await createServer({
  configFile: false,
  envDir: false,
  cacheDir: "node_modules/.vite-audio-smoke",
  optimizeDeps: { noDiscovery: true, entries: [], include: ["react", "react-dom/client"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "isolated-audio-smoke",
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.startsWith("/favicon")) { response.statusCode = 204; response.end(); return; }
        if (request.url === "/audio-smoke") {
          response.setHeader("Content-Type", "text/html");
          response.end('<!doctype html><link rel="icon" href="data:,"><div id="root"></div><script type="module" src="/audio-smoke.js"></script>');
        } else if (request.url === "/audio-smoke.js") {
          response.setHeader("Content-Type", "application/javascript");
          response.end(fixture);
        } else next();
      });
    },
  }],
});

let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    args: ["--autoplay-policy=user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error("Browser error:", error.message); });
  page.on("console", (message) => { if (message.type() === "error") console.error("Browser console:", message.text()); });
  await page.goto(`http://127.0.0.1:${port}/audio-smoke`);
  await page.getByRole("button", { name: "Start synthetic audio" }).click();
  await page.waitForFunction(() => window.audioStats.frames > 4 || window.audioStats.error, null, { timeout: 8000 });
  const first = await page.evaluate(() => window.audioStats);
  assert.equal(first.error, null);
  assert.ok(first.peak > 1000, "Production capture must forward non-silent PCM16");
  const mutedFrames = await page.evaluate(() => { window.audioControls.mute(); return window.audioStats.frames; });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.audioStats.frames), mutedFrames, "Mute must stop outgoing frames");
  await page.evaluate(() => window.audioControls.unmute());
  await page.waitForFunction((count) => window.audioStats.frames > count + 4, mutedFrames);
  await page.evaluate(() => window.audioControls.play());
  await page.waitForFunction(() => window.audioStats.playbackEnded && window.audioStats.drained);
  await page.evaluate(() => window.audioControls.stop());
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    result: "PASS", browser: await browser.version(),
    capture: "non-silent 16kHz PCM16", mute: "PASS", unmute: "PASS", playback: "24kHz rendered and drained",
    credentialsLoaded: false, realMicrophoneUsed: false, geminiCalled: false,
  }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
