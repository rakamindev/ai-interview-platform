import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssessmentInvitePage from './AssessmentInvitePage';
import { assessmentsApi } from '@/services/assessments';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API calls
vi.mock('@/services/assessments', () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

describe('AssessmentInvitePage FE-01', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders "Results" button even if session end_reason is error', async () => {
    const mockAssessment = {
      id: 1,
      name: 'Test Assessment',
      time_limit_min: 30,
      skills: [],
    };

    const mockSession = {
      id: 101,
      candidate_name: 'Budi (Error Case)',
      status: 'ended',
      end_reason: 'error',
      audit_status: null,
      invite_url: 'http://localhost/invite/101',
    };

    // Setup mock returns
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: mockAssessment } } as any);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [mockSession] } } as any);

    render(
      <MemoryRouter initialEntries={['/assessments/1']}>
        <Routes>
          <Route path="/assessments/:id" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for loading to finish and component to render
    await waitFor(() => {
      expect(screen.getByText('Budi (Error Case)')).toBeInTheDocument();
    });

    // The Results button MUST be present even if end_reason is 'error' (FE-01 Lockout Bug fix)
    const resultsButton = screen.getByRole('button', { name: /results/i });
    expect(resultsButton).toBeInTheDocument();
  });
});
