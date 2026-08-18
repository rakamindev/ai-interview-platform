import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InterviewPage from './InterviewPage';
import { sessionsApi } from '@/services/sessions';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as useAudioWebSocketModule from '@/hooks/useAudioWebSocket';
import * as useAudioCaptureModule from '@/hooks/useAudioCapture';
import * as useAudioPlaybackModule from '@/hooks/useAudioPlayback';

// Mock the API calls
vi.mock('@/services/sessions', () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('@/hooks/useAudioWebSocket', () => ({
  useAudioWebSocket: vi.fn(),
}));
vi.mock('@/hooks/useAudioCapture', () => ({
  useAudioCapture: vi.fn(),
}));
vi.mock('@/hooks/useAudioPlayback', () => ({
  useAudioPlayback: vi.fn(),
}));

vi.mock('@/components/HardwareCheck', () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button data-testid="mock-hardware-check-start" onClick={onStart}>
      Mock Start
    </button>
  ),
}));

describe('InterviewPage FE-03', () => {
  const mockDisconnect = vi.fn();
  const mockAudioComplete = vi.fn().mockResolvedValue({ data: { success: true } });

  beforeEach(() => {
    vi.resetAllMocks();
    
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 1,
        candidate_name: 'Test Candidate',
        role_title: 'Software Engineer',
        time_limit_min: 1, // 1 minute for test
        session_status: 'active',
      }
    } as any);

    vi.mocked(sessionsApi.audioComplete).mockImplementation(mockAudioComplete);

    vi.mocked(useAudioWebSocketModule.useAudioWebSocket).mockReturnValue({
      connect: vi.fn(),
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: mockDisconnect,
      connectionState: 'connected',
    } as any);

    vi.mocked(useAudioCaptureModule.useAudioCapture).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
    } as any);

    vi.mocked(useAudioPlaybackModule.useAudioPlayback).mockReturnValue({
      playChunk: vi.fn(),
      stop: vi.fn(),
      scheduleAfterPlayback: vi.fn((cb) => cb()),
      waitForDrain: vi.fn((cb) => cb()),
      cancelDrain: vi.fn(),
    } as any);
  });

  it('calls audio_complete BEFORE disconnecting when endInterview is triggered', async () => {
    // We will simulate clicking the "End call" button to trigger endInterview
    render(
      <MemoryRouter initialEntries={['/interview/mock-token']}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click mock start
    const mockStartBtn = await screen.findByTestId('mock-hardware-check-start');
    await act(async () => {
      mockStartBtn.click();
    });

    // Wait for page to load into active state
    await waitFor(() => {
      expect(screen.getByText(/End call/i)).toBeInTheDocument();
    });

    // We need to click "End call" and then confirm
    const endCallBtn = screen.getByRole('button', { name: /End call/i });
    act(() => {
      endCallBtn.click();
    });

    const confirmBtn = await screen.findByRole('button', { name: /End interview/i });
    
    // Setup call order tracking
    let callOrder: string[] = [];
    mockAudioComplete.mockImplementation(async () => {
      callOrder.push('audioComplete');
      return { data: { success: true } };
    });
    mockDisconnect.mockImplementation(() => {
      callOrder.push('disconnect');
    });

    await act(async () => {
      confirmBtn.click();
    });

    // Wait for disconnect to be called
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    // Assert that audioComplete was called AND it was called BEFORE disconnect
    expect(mockAudioComplete).toHaveBeenCalled();
    expect(callOrder).toEqual(['audioComplete', 'disconnect']);
  });
});
