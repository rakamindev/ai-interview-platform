import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ComparisonTable from './ComparisonTable';

describe('comparison review', () => {
  it('renders the actual API expected_level field and assessor provenance', () => {
    render(<ComparisonTable comparisons={[{
      skill_label: 'Database design', expected_level: 4, candidate_level: 3,
      ai_level: 2, rating_source: 'assessor', result: 'gap', delta: -1, confidence: 'medium',
    }]} />);
    const row = screen.getByRole('row', { name: /Database design/ });
    expect(within(row).getByText('L4')).toBeVisible();
    expect(within(row).getByText('L3')).toBeVisible();
    expect(within(row).getByText(/Human reviewed/)).toBeVisible();
    expect(within(row).getByText(/AI: L2/)).toBeVisible();
  });

  it('counts missing evidence separately and never shows a missing rating as L1', () => {
    render(<ComparisonTable comparisons={[{
      skill_label: 'Communication', expected_level: 3, candidate_level: null,
      rating_source: 'none', result: 'not_assessed', delta: null, confidence: null,
    }]} />);
    expect(screen.getByText('Not assessed')).toBeVisible();
    expect(screen.queryByText('L1')).not.toBeInTheDocument();
    expect(screen.getByText(/No rating/)).toBeVisible();
  });

  it('explains an empty vacancy rather than presenting a blank table', () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/No skill requirements/)).toBeVisible();
  });
});
