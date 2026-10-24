import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import InterviewPage from './InterviewPage';
import { sessionsApi } from '@/services/sessions';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock dependencies
vi.mock('@/services/sessions', () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock('@/hooks/useAudioCapture', () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAudioPlayback', () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAudioWebSocket', () => ({
  useAudioWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: 'connected',
  }),
}));

describe('InterviewPage FSM & Failure Recovery (Seeded Fault Test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions to ERROR state when session loading fails, NOT false complete', async () => {
    // Simulate API network failure or invalid session token
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValueOnce({
      response: { data: { error: 'Sesi wawancara tidak valid atau telah kadaluarsa.' } },
    });

    render(
      <MemoryRouter initialEntries={['/interview/mock-token-xyz']}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // CRITICAL ASSERTION:
    // Old buggy behavior falsely displayed "Interview Complete. The interview has been recorded".
    // Our revamped state machine MUST NOT display "Interview Complete".
    await waitFor(() => {
      expect(screen.queryByText(/Interview Complete/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Koneksi Wawancara Terputus/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Sesi wawancara tidak valid atau telah kadaluarsa\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coba Hubungkan Ulang/i })).toBeInTheDocument();
  });
});
