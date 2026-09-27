import type { WebSocket } from 'ws';
import { generateSyntheticAudioBase64 } from './audio';
import type { Scenario, GeminiSetupMessage, GeminiRealtimeInputMessage, GeminiServerMessage } from './types';

// Track sessions that have undergone simulated socket drops across reconnections
export const droppedSessions = new Set<string>();

// The models real Gemini Live accepts for bidiGenerateContent. The deprecated
// gemini-2.0-flash-live-001 (and other retired Live API models) are rejected
// with close code 1008, mirroring the real endpoint.
const SUPPORTED_LIVE_MODELS = ['models/gemini-3.1-flash-live-preview'];

export class MockGeminiSession {
  public readonly id: string;
  public readonly scenario: Scenario;
  private ws: WebSocket;
  private turnState:
    | 'CREATED'
    | 'READY'
    | 'SPEAKING_GREETING'
    | 'WAITING_CANDIDATE_1'
    | 'SPEAKING_FOLLOW_UP'
    | 'WAITING_CANDIDATE_2'
    | 'SPEAKING_CLOSING'
    | 'CLOSED' = 'CREATED';

  public resumptionHandle: string;
  public isResumed: boolean = false;
  private candidateAudioChunks: number = 0;
  private candidateTurnStart: number = 0;
  private candidateAudioTimer: NodeJS.Timeout | null = null;
  private disposed: boolean = false;

  constructor(ws: WebSocket, sessionId: string, scenario: Scenario) {
    this.ws = ws;
    this.id = sessionId;
    this.scenario = scenario;
    this.resumptionHandle = `mock-resumption-handle-${sessionId}`;
  }

  public handleMessage(data: any, isBinary?: boolean) {
    if (this.disposed || !this.isOpen()) return;

    if (isBinary) {
      this.handleCandidateAudioChunk();
      return;
    }

    try {
      const text = typeof data === 'string' ? data : data.toString('utf-8');
      if (text.trim().startsWith('{')) {
        const msg = JSON.parse(text);
        this.handleJsonMessage(msg);
      } else {
        this.handleCandidateAudioChunk();
      }
    } catch (e) {
      console.warn(`[Mock Gemini] Error handling message for session ${this.id}:`, e);
    }
  }

  private handleJsonMessage(msg: any) {
    if (msg.setup) {
      this.handleSetup(msg as GeminiSetupMessage);
    } else if (msg.realtimeInput) {
      this.handleRealtimeInput(msg as GeminiRealtimeInputMessage);
    }
  }

  private handleSetup(msg: GeminiSetupMessage) {
    // Faithful to real Gemini Live: reject deprecated/unsupported models with
    // close code 1008 before the session is established (mirrors the real
    // "models/gemini-2.0-flash-live-001 is not found ... bidiGenerateContent").
    const model = msg.setup.model;
    if (model && !SUPPORTED_LIVE_MODELS.includes(model)) {
      console.warn(`[Mock Gemini] Rejecting unsupported model ${model} (code 1008)`);
      this.ws.close(
        1008,
        `${model} is not found for API version v1beta, or is not supported for bidiGenerateContent.`
      );
      return;
    }

    const handle = msg.setup.sessionResumption?.handle;
    if (handle) {
      this.isResumed = true;
      this.resumptionHandle = `mock-resumption-handle-${this.id}-resumed-${Date.now()}`;
      console.log(`[Mock Gemini] Session ${this.id} resumed with handle: ${handle}`);
    } else {
      this.isResumed = false;
      this.resumptionHandle = `mock-resumption-handle-${this.id}`;
    }

    this.turnState = this.isResumed ? 'WAITING_CANDIDATE_1' : 'READY';

    // 1. Send setupComplete
    this.sendJson({ setupComplete: {} });

    // 2. Emit sessionResumption handle
    this.sendJson({
      sessionResumption: {
        handle: this.resumptionHandle,
      },
    });
  }

  private handleRealtimeInput(msg: GeminiRealtimeInputMessage) {
    const { text, audio } = msg.realtimeInput;

    if (text) {
      // Check for wrap-up signal injection: [TIME CONTROL:SYS-TC-7x9k]
      if (text.includes('SYS-TC-7x9k') || text.includes('"wrap_up": true') || text.includes('wrap_up')) {
        console.log(`[Mock Gemini] Wrap-up signal received for session ${this.id}`);
        this.triggerWrapUp();
        return;
      }

      // Check for opening prompt
      if (text.includes('[Start the interview') || text.includes('Greet the candidate')) {
        console.log(`[Mock Gemini] Trigger opening received for session ${this.id}`);
        this.triggerOpening();
        return;
      }
    }

    if (audio) {
      this.handleCandidateAudioChunk();
    }
  }

  private handleCandidateAudioChunk() {
    if (this.turnState !== 'WAITING_CANDIDATE_1' && this.turnState !== 'WAITING_CANDIDATE_2') {
      return;
    }

    if (!this.candidateTurnStart) {
      this.candidateTurnStart = Date.now();
    }
    this.candidateAudioChunks++;

    const elapsed = Date.now() - this.candidateTurnStart;
    // Complete candidate speech if >= 3 chunks and 200ms elapsed, or max 500ms
    if (this.candidateAudioChunks >= 3 && elapsed >= 200) {
      if (this.candidateAudioTimer) clearTimeout(this.candidateAudioTimer);
      this.candidateAudioTimer = null;
      this.handleCandidateSpeechFinished();
    } else if (!this.candidateAudioTimer) {
      this.candidateAudioTimer = setTimeout(() => {
        this.handleCandidateSpeechFinished();
      }, 200);
    }
  }

  private handleCandidateSpeechFinished() {
    if (this.disposed || !this.isOpen()) return;

    if (this.candidateAudioTimer) {
      clearTimeout(this.candidateAudioTimer);
      this.candidateAudioTimer = null;
    }

    if (this.turnState === 'WAITING_CANDIDATE_1') {
      this.turnState = 'SPEAKING_FOLLOW_UP';

      // 1. Emit candidate input transcription
      this.sendJson({
        serverContent: {
          inputTranscription: {
            text: 'Halo! Saya memiliki pengalaman lima tahun mengembangkan aplikasi web dengan React dan Ruby on Rails.',
          },
        },
      });

      // 2. Emit turnComplete to trigger turn handover to Rails
      this.sendJson({
        serverContent: {
          turnComplete: true,
        },
      });

      // 3. Emit Model Follow-up Turn (give conversational cadence window)
      setTimeout(() => {
        if (this.disposed || !this.isOpen()) return;
        this.sendModelTurn(
          'Bagus sekali. Bisakah Anda menjelaskan bagaimana Anda merancang arsitektur sistem yang scalable dan reliabel?',
          false,
          () => {
            this.turnState = 'WAITING_CANDIDATE_2';
            this.candidateAudioChunks = 0;
            this.candidateTurnStart = 0;
          }
        );
      }, 1500);
    } else if (this.turnState === 'WAITING_CANDIDATE_2') {
      this.turnState = 'SPEAKING_CLOSING';

      // 1. Emit candidate input transcription
      this.sendJson({
        serverContent: {
          inputTranscription: {
            text: 'Saya memisahkan antrean asinkronus, menggunakan Redis caching, dan connection pooling.',
          },
        },
      });

      // 2. Emit turnComplete
      this.sendJson({
        serverContent: {
          turnComplete: true,
        },
      });

      // 3. Proceed to closing turn
      setTimeout(() => {
        if (this.disposed || !this.isOpen()) return;
        this.sendModelTurn(
          'Terima kasih banyak atas waktu dan penjelasan Anda yang sangat jelas. Sesi wawancara ini telah selesai. Semoga sukses dan sampai jumpa!',
          true,
          () => {
            this.turnState = 'CLOSED';
          }
        );
      }, 100);
    }
  }

  public triggerOpening() {
    if (this.turnState === 'CLOSED' || this.turnState === 'SPEAKING_GREETING') return;

    this.turnState = 'SPEAKING_GREETING';
    this.sendModelTurn(
      'Halo! Selamat datang di sesi wawancara teknis. Bisakah Anda menceritakan pengalaman terakhir Anda dalam pengembangan perangkat lunak?',
      false,
      () => {
        this.turnState = 'WAITING_CANDIDATE_1';
        this.candidateAudioChunks = 0;
        this.candidateTurnStart = 0;
      }
    );
  }

  public triggerWrapUp() {
    if (this.turnState === 'CLOSED' || this.turnState === 'SPEAKING_CLOSING') return;

    if (this.candidateAudioTimer) {
      clearTimeout(this.candidateAudioTimer);
      this.candidateAudioTimer = null;
    }

    this.turnState = 'SPEAKING_CLOSING';
    this.sendModelTurn(
      'Terima kasih banyak atas waktu dan jawaban Anda. Sesi wawancara ini telah selesai. Semoga sukses dan sampai jumpa!',
      true,
      () => {
        this.turnState = 'CLOSED';
      }
    );
  }

  private sendModelTurn(text: string, isClosing: boolean = false, onComplete?: () => void) {
    const audioBase64 = generateSyntheticAudioBase64(200, 24000);

    // 1. Emit modelTurn with synthetic 24kHz PCM audio and outputTranscription
    this.sendJson({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=24000',
                data: audioBase64,
              },
            },
          ],
        },
        outputTranscription: {
          text,
        },
      },
    });

    // 2. Emit generationComplete & turnComplete
    setTimeout(() => {
      if (this.disposed || !this.isOpen()) return;

      this.sendJson({
        serverContent: {
          generationComplete: true,
          turnComplete: true,
        },
      });

      // Resumption scenario: drop socket after turn 1 if not previously dropped
      if (
        this.scenario === 'resumption' &&
        !this.isResumed &&
        !droppedSessions.has(this.id)
      ) {
        droppedSessions.add(this.id);
        console.log(`[Mock Gemini] Resumption scenario: dropping socket after Turn 1 for session ${this.id}`);
        setTimeout(() => {
          if (!this.disposed && this.isOpen()) {
            this.ws.close(1011, 'Simulated disconnect for resumption test');
          }
        }, 150);
        return;
      }

      onComplete?.();
    }, 40);
  }

  public sendJson(obj: GeminiServerMessage) {
    if (this.isOpen()) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  public isOpen(): boolean {
    return this.ws.readyState === 1; // WebSocket.OPEN
  }

  public dispose() {
    this.disposed = true;
    if (this.candidateAudioTimer) {
      clearTimeout(this.candidateAudioTimer);
      this.candidateAudioTimer = null;
    }
  }
}
