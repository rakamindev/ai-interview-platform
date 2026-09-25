import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FitGapReportPage from '@/pages/fitgap/FitGapReportPage';
import { sessionsApi } from '@/services/sessions';
import { portfoliosApi } from '@/services/portfolios';
vi.mock('@/services/sessions', () => ({sessionsApi: {getPortfolio: vi.fn()}}));
vi.mock('@/services/portfolios', () => ({portfoliosApi: {getFitGap: vi.fn(), triggerFitGap: vi.fn(), exportPortfolio: vi.fn()}}));
const mount = () => render(<MemoryRouter initialEntries={['/assessments/1/sessions/1/fitgap/1']}><Routes><Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({data: {portfolio: {id: 1, generation_status: 'complete', skills: [], overrides: []}}} as never);
});
it('shows an actionable error and retries without enqueuing AI jobs', async () => {
  vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data: {report: {skill_comparisons: [], overall_narrative: 'No skills assessed'}}} as never);
  mount();
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByText('Try again'));
  expect(await screen.findByText('No skills assessed')).toBeTruthy();
  expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  expect(portfoliosApi.getFitGap).toHaveBeenCalledTimes(2);
});
it('does not fetch or enqueue fit/gap for an unfinished portfolio', async () => {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({data: {status: 'generating'}} as never);
  mount();
  await screen.findByRole('alert');
  expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
  expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
});
