import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { MockGeminiSession, droppedSessions } from './session';
import type { Scenario } from './types';

export const activeSessions = new Map<string, MockGeminiSession>();
export const scenarioOverrides = new Map<string, Scenario>();

export function determineScenario(
  urlStr: string,
  headers: http.IncomingHttpHeaders = {}
): Scenario {
  try {
    const parsedUrl = new URL(urlStr, 'http://localhost');
    const sessionId = parsedUrl.searchParams.get('session_id') || '';
    const token = parsedUrl.searchParams.get('token') || '';
    const scenarioParam = parsedUrl.searchParams.get('scenario') || '';
    const headerScenario = (headers['x-scenario'] as string) || '';

    // Check explicit override
    if (sessionId && scenarioOverrides.has(sessionId)) {
      return scenarioOverrides.get(sessionId)!;
    }
    if (token && scenarioOverrides.has(token)) {
      return scenarioOverrides.get(token)!;
    }

    const combined = `${parsedUrl.pathname} ${sessionId} ${token} ${scenarioParam} ${headerScenario}`.toLowerCase();
    if (combined.includes('resumption')) {
      return 'resumption';
    }
  } catch (e) {
    // If URL parsing fails, check raw string
    if (urlStr.toLowerCase().includes('resumption')) {
      return 'resumption';
    }
  }

  return 'happy-path';
}

export function extractSessionId(urlStr: string): string {
  try {
    const parsedUrl = new URL(urlStr, 'http://localhost');
    const sessionId = parsedUrl.searchParams.get('session_id') || parsedUrl.searchParams.get('token');
    if (sessionId) return sessionId;
  } catch (e) {
    // fallback
  }
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

let httpServer: http.Server | null = null;
let wssServer: WebSocketServer | null = null;

export function createMockGeminiServer(): { server: http.Server; wss: WebSocketServer } {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'mock-gemini' }));
      return;
    }

    // API to set scenario override
    if (url.pathname === '/api/scenario' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { sessionId, scenario } = JSON.parse(body);
          if (sessionId && scenario) {
            scenarioOverrides.set(sessionId, scenario);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', sessionId, scenario }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // API to trigger wrap-up on active session
    if ((url.pathname === '/api/wrap-up' || url.pathname === '/inject-wrap-up') && req.method === 'POST') {
      const sessionId = url.searchParams.get('session_id');
      if (sessionId && activeSessions.has(sessionId)) {
        activeSessions.get(sessionId)!.triggerWrapUp();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', action: 'wrap-up-triggered', sessionId }));
      } else {
        // Trigger on all active sessions if no specific session requested
        for (const session of activeSessions.values()) {
          session.triggerWrapUp();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', action: 'wrap-up-all' }));
      }
      return;
    }

    // API to reset state
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      droppedSessions.clear();
      scenarioOverrides.clear();
      for (const session of activeSessions.values()) {
        session.dispose();
      }
      activeSessions.clear();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', reset: true }));
      return;
    }

    // API to inspect active sessions
    if (url.pathname === '/api/sessions') {
      const list = Array.from(activeSessions.entries()).map(([id, s]) => ({
        id,
        scenario: s.scenario,
        isResumed: s.isResumed,
        resumptionHandle: s.resumptionHandle,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions: list, droppedSessionIds: Array.from(droppedSessions) }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const rawUrl = req.url || '';
    const sessionId = extractSessionId(rawUrl);
    const scenario = determineScenario(rawUrl, req.headers);

    console.log(`[Mock Gemini] Connection received: session_id=${sessionId} scenario=${scenario} url=${rawUrl}`);

    const session = new MockGeminiSession(ws, sessionId, scenario);
    activeSessions.set(sessionId, session);

    ws.on('message', (data: any, isBinary: boolean) => {
      session.handleMessage(data, isBinary);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[Mock Gemini] Connection closed: session_id=${sessionId} code=${code} reason=${reason.toString()}`);
      session.dispose();
      if (activeSessions.get(sessionId) === session) {
        activeSessions.delete(sessionId);
      }
    });

    ws.on('error', (err: Error) => {
      console.error(`[Mock Gemini] WebSocket error on session ${sessionId}:`, err);
    });
  });

  return { server, wss };
}

export function startServer(port: number = 8080): Promise<http.Server> {
  return new Promise((resolve) => {
    const { server, wss } = createMockGeminiServer();
    httpServer = server;
    wssServer = wss;

    httpServer.listen(port, () => {
      console.log(`[Mock Gemini] Server listening on port ${port}`);
      resolve(httpServer!);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (wssServer) {
      wssServer.close();
      wssServer = null;
    }
    if (httpServer) {
      httpServer.close(() => {
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Auto-start if invoked directly via tsx / node
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  startServer(PORT);
}
