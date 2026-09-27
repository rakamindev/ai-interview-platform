import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer, stopServer } from './server';

const TEST_PORT = 8089;
const WS_BASE = `ws://localhost:${TEST_PORT}`;
const HTTP_BASE = `http://localhost:${TEST_PORT}`;

function createSyntheticAudioChunk(): string {
  // 100ms of 16kHz audio = 1600 samples * 2 bytes = 3200 bytes
  return Buffer.alloc(3200).toString('base64');
}

class MessageCollector {
  private queue: any[] = [];
  private waiter: ((msg: any) => void) | null = null;
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = null;
          w(parsed);
        } else {
          this.queue.push(parsed);
        }
      } catch (e) {
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = null;
          w(data);
        } else {
          this.queue.push(data);
        }
      }
    });
  }

  async nextMessage(timeoutMs: number = 3000): Promise<any> {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error(`Timeout waiting for message after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waiter = (msg) => {
        clearTimeout(timer);
        resolve(msg);
      };
    });
  }
}

function waitForClose(ws: WebSocket, timeoutMs: number = 3000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for close after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

test.before(async () => {
  await startServer(TEST_PORT);
});

test.after(async () => {
  await stopServer();
});

test('HTTP /health endpoint returns status ok', async () => {
  const res = await fetch(`${HTTP_BASE}/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
  assert.equal(json.service, 'mock-gemini');
});

test('Gemini protocol setup handshake responds with setupComplete and sessionResumption', async () => {
  const ws = new WebSocket(`${WS_BASE}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`);
  const collector = new MessageCollector(ws);

  await new Promise<void>((resolve) => ws.once('open', () => resolve()));

  // Send setup frame
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generationConfig: { responseModalities: ['AUDIO'] },
      sessionResumption: {},
    },
  }));

  // Should receive setupComplete
  const msg1 = await collector.nextMessage();
  assert.ok(msg1.setupComplete !== undefined, 'Expected setupComplete frame');

  // Should receive sessionResumption
  const msg2 = await collector.nextMessage();
  assert.ok(msg2.sessionResumption !== undefined, 'Expected sessionResumption frame');
  assert.ok(typeof msg2.sessionResumption.handle === 'string');

  ws.close();
});

test('Rejects deprecated live models with close code 1008 (mirrors real Gemini)', async () => {
  const ws = new WebSocket(`${WS_BASE}/ws?session_id=e2e-token-happy-path`);

  await new Promise<void>((resolve) => ws.once('open', () => resolve()));

  // Setup with the retired model real Gemini no longer serves for bidiGenerateContent.
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-2.0-flash-live-001',
      sessionResumption: {},
    },
  }));

  const { code, reason } = await waitForClose(ws);
  assert.equal(code, 1008, 'Expected close code 1008 for unsupported model');
  assert.match(reason, /gemini-2\.0-flash-live-001/);
  assert.match(reason, /not found for API version v1beta|not supported for bidiGenerateContent/);
});

test('Happy Path: greeting -> candidate PCM -> follow-up question -> wrap-up signal -> clean close', async () => {
  const ws = new WebSocket(`${WS_BASE}/ws?session_id=e2e-token-happy-path`);
  const collector = new MessageCollector(ws);

  await new Promise<void>((resolve) => ws.once('open', () => resolve()));

  // 1. Handshake
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      sessionResumption: {},
    },
  }));

  const setupCompleteMsg = await collector.nextMessage();
  assert.ok(setupCompleteMsg.setupComplete !== undefined);

  const resumptionMsg = await collector.nextMessage();
  assert.ok(resumptionMsg.sessionResumption?.handle);

  // 2. Trigger Opening
  ws.send(JSON.stringify({
    realtimeInput: { text: '[Start the interview. Greet the candidate and ask your first question.]' },
  }));

  // Should receive model turn 1 (Greeting)
  const greetingContent = await collector.nextMessage();
  assert.ok(greetingContent.serverContent?.modelTurn?.parts?.length > 0);
  const part = greetingContent.serverContent.modelTurn.parts[0];
  assert.equal(part.inlineData?.mimeType, 'audio/pcm;rate=24000');
  assert.ok(part.inlineData?.data?.length > 0);
  assert.ok(greetingContent.serverContent.outputTranscription?.text);

  // Generation complete & turn complete
  const greetingComplete = await collector.nextMessage();
  assert.ok(greetingComplete.serverContent?.generationComplete);
  assert.ok(greetingComplete.serverContent?.turnComplete);

  // 3. Candidate sends PCM audio
  const audioBase64 = createSyntheticAudioChunk();
  for (let i = 0; i < 3; i++) {
    ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: audioBase64,
        },
      },
    }));
  }

  // Should receive candidate input transcription
  const candidateTx = await collector.nextMessage();
  assert.ok(candidateTx.serverContent?.inputTranscription?.text);

  const candidateTxComplete = await collector.nextMessage();
  assert.ok(candidateTxComplete.serverContent?.turnComplete);

  // Should receive Turn 2 (Follow-up question)
  const followUpContent = await collector.nextMessage();
  assert.ok(followUpContent.serverContent?.modelTurn?.parts?.length > 0);
  assert.ok(followUpContent.serverContent.outputTranscription?.text);

  const followUpComplete = await collector.nextMessage();
  assert.ok(followUpComplete.serverContent?.generationComplete);
  assert.ok(followUpComplete.serverContent?.turnComplete);

  // 4. Inject Wrap-up Signal
  ws.send(JSON.stringify({
    realtimeInput: {
      text: '[TIME CONTROL:SYS-TC-7x9k] { "wrap_up": true, "all_skills_covered": true }',
    },
  }));

  // Should receive Closing Turn
  const closingContent = await collector.nextMessage();
  assert.ok(closingContent.serverContent?.modelTurn?.parts?.length > 0);
  const closingText = closingContent.serverContent.outputTranscription?.text.toLowerCase();
  assert.ok(
    closingText.includes('terima kasih banyak atas waktu') || closingText.includes('sampai jumpa'),
    `Expected closing phrase in: "${closingText}"`
  );

  const closingComplete = await collector.nextMessage();
  assert.ok(closingComplete.serverContent?.generationComplete);
  assert.ok(closingComplete.serverContent?.turnComplete);

  ws.close();
});

test('Resumption Scenario: drops socket after turn 1; resumes seamlessly when reconnected with handle', async () => {
  const sessionId = 'e2e-token-resumption';
  const ws1 = new WebSocket(`${WS_BASE}/ws?session_id=${sessionId}`);
  const collector1 = new MessageCollector(ws1);

  await new Promise<void>((resolve) => ws1.once('open', () => resolve()));

  // 1. Initial Handshake
  ws1.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      sessionResumption: {},
    },
  }));

  await collector1.nextMessage(); // setupComplete
  const resumptionMsg = await collector1.nextMessage();
  const handle = resumptionMsg.sessionResumption?.handle;
  assert.ok(handle, 'Expected resumption handle');

  // Trigger Opening
  ws1.send(JSON.stringify({
    realtimeInput: { text: '[Start the interview. Greet the candidate and ask your first question.]' },
  }));

  await collector1.nextMessage(); // greeting
  await collector1.nextMessage(); // completion

  // Socket should drop after turn 1
  const { code } = await waitForClose(ws1);
  assert.equal(code, 1011, 'Expected code 1011 for simulated disconnect');

  // 2. Reconnection with prior resumption handle
  const ws2 = new WebSocket(`${WS_BASE}/ws?session_id=${sessionId}`);
  const collector2 = new MessageCollector(ws2);
  await new Promise<void>((resolve) => ws2.once('open', () => resolve()));

  ws2.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      sessionResumption: { handle },
    },
  }));

  const reconnectedSetup = await collector2.nextMessage();
  assert.ok(reconnectedSetup.setupComplete !== undefined);

  const reconnectedResumption = await collector2.nextMessage();
  assert.ok(reconnectedResumption.sessionResumption?.handle);

  // Send candidate audio
  const audioBase64 = createSyntheticAudioChunk();
  for (let i = 0; i < 3; i++) {
    ws2.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: audioBase64,
        },
      },
    }));
  }

  // Should resume conversation without dropping
  const candidateTx = await collector2.nextMessage();
  assert.ok(candidateTx.serverContent?.inputTranscription?.text);

  const candidateComplete = await collector2.nextMessage();
  assert.ok(candidateComplete.serverContent?.turnComplete);

  const resumedModelTurn = await collector2.nextMessage();
  assert.ok(resumedModelTurn.serverContent?.modelTurn?.parts?.length > 0);

  ws2.close();
});
