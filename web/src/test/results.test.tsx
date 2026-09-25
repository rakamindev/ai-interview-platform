import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ComparisonTable from '@/components/fitgap/ComparisonTable';
import LevelBadge from '@/components/portfolio/LevelBadge';
import OverridePanel from '@/components/portfolio/OverridePanel';
import { parseLevel } from '@/utils/constants';
import { portfoliosApi } from '@/services/portfolios';

vi.mock('@/services/portfolios', () => ({ portfoliosApi: { getOverride: vi.fn() } }));

describe('Honest assessment results', () => {
  it.each([null, undefined, 'L3', '3', '', 0, 6, 2.5, NaN])('does not convert %s to L1', value => {
    expect(parseLevel(value)).toBeNull();
  });

  it('renders required levels from the actual API contract and counts unassessed skills', () => {
    render(<ComparisonTable comparisons={[
      { skill_label: 'Ruby', expected_level: 3, candidate_level: 4, result: 'exceed', delta: 1, is_override: true },
      { skill_label: 'SQL', expected_level: 2, candidate_level: null, result: 'not_assessed', delta: null },
    ]} />);
    expect(screen.getByText('L3')).toBeTruthy();
    expect(screen.getByText('L4')).toBeTruthy();
    expect(screen.getByText('Not assessed: 1')).toBeTruthy();
    expect(screen.getByText('✏')).toBeTruthy();
  });

  it('shows an honest empty state', () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/No skills are configured/)).toBeTruthy();
  });

  it('does not render L1 for an unknown level', () => {
    render(<LevelBadge level={null} />);
    expect(screen.getByText('Not assessed')).toBeTruthy();
    expect(screen.queryByText('L1')).toBeNull();
  });

  it('requires a deliberate rating and explanation before saving an unassessed override', async () => {
    vi.mocked(portfoliosApi.getOverride).mockResolvedValue({ data: { override: { id: 1 } } } as never);
    render(<OverridePanel skill={{id: 1, skill_label: 'Ruby', is_discovered: false, ai_level: null, ai_confidence: 'low', evidence: [], competency_summary: 'Not assessed'}} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText(/Override rating/));
    const save = screen.getByText('Save override') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason for this rating:'), {target: {value: 'Reviewed the transcript'}});
    expect(save.disabled).toBe(true);
    // Unknown ratings must not silently preselect the lowest level.
    expect(portfoliosApi.getOverride).not.toHaveBeenCalled();
  });
});
