import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FitGapReportPage from './FitGapReportPage';
import { portfoliosApi } from '@/services/portfolios';
import { sessionsApi } from '@/services/sessions';
import type { FitGapReport } from '@/types';

vi.mock('@/services/portfolios', () => ({ portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn() } }));
vi.mock('@/services/sessions', () => ({ sessionsApi: { getPortfolio: vi.fn() } }));
const report: FitGapReport = {
  id: 1, portfolio_id: 1, vacancy_id: 1, role_title: 'Backend Engineer', generation_status: 'complete',
  skill_comparisons: [{ skill_label: 'Communication', expected_level: 3, candidate_level: null, result: 'not_assessed', delta: null, rating_source: 'none' }],
  generated_at: '2026-10-25T14:00:00Z', culture_narrative: null, overall_narrative: 'Missing evidence is not a skill deficit.',
  summary: { total_requirements: 1, assessed_count: 0, match_count: 0, exceed_count: 0, gap_count: 0, not_assessed_count: 1, reviewed_count: 0, low_confidence_count: 0 },
};
const response = (data: unknown) => ({ data } as never);
function openPage() { return render(<MemoryRouter initialEntries={['/assessments/1/sessions/1/fitgap/1']}><Routes><Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} /></Routes></MemoryRouter>); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(response({ portfolio: { id: 1, generation_status: 'complete', candidate_name: 'Synthetic Candidate', skills: [], overrides: [] } }));
  vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(response({ report }));
});

describe('fit/gap review lifecycle', () => {
  it('shows evidence completeness and the role benchmark from the response', async () => {
    openPage();
    expect(await screen.findByText('0 of 1 requirements assessed')).toBeVisible();
    expect(screen.getByText(/An unassessed skill is not a demonstrated gap/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });

  it('surfaces initial network errors and offers retry', async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error('offline'));
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not load');
    await userEvent.click(screen.getByRole('button', { name: 'Try loading again' }));
    expect(await screen.findByText('0 of 1 requirements assessed')).toBeVisible();
  });

  it('does not generate repeatedly when a pending report is returned', async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce({ response: { status: 404 } });
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(response({ report: { ...report, generation_status: 'pending', generated_at: null } }));
    openPage();
    expect(await screen.findByText('Preparing your comparison')).toBeVisible();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Refresh comparison' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  });

  it('preserves a failed snapshot and lets the user request a retry', async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(response({ report: { ...report, generation_status: 'failed', error_code: 'queue_unavailable' } }));
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue(response({ report: { ...report, generation_status: 'pending' } }));
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('queue is unavailable');
    expect(screen.getByText('0 of 1 requirements assessed')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retry comparison' }));
    expect(await screen.findByText('Preparing your comparison')).toBeVisible();
    expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledTimes(1);
  });

  it('blocks exports of stale reports while retaining their content', async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(response({ report: { ...report, generation_status: 'stale' } }));
    openPage();
    expect(await screen.findByText('Ratings or requirements have changed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    expect(screen.getByText('0 of 1 requirements assessed')).toBeVisible();
  });

  it('does not silently hide a failed refresh', async () => {
    vi.mocked(portfoliosApi.regenerateFitGap).mockRejectedValue(new Error('offline'));
    openPage();
    await screen.findByText('0 of 1 requirements assessed');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh comparison' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('previous report has been preserved');
    expect(screen.getByText('0 of 1 requirements assessed')).toBeVisible();
  });

  it('shows download errors and prevents exporting potentially changed content', async () => {
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue(new Error('conflict'));
    openPage();
    await screen.findByText('0 of 1 requirements assessed');
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('export could not be downloaded');
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Check status' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download JSON' })).toBeEnabled());
  });

  it('does not create a report when the portfolio is still pending', async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(response({ status: 'generating' }));
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('portfolio is not ready');
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });
});
