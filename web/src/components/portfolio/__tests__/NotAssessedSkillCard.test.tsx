import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotAssessedSkillCard from '../NotAssessedSkillCard';

describe('NotAssessedSkillCard', () => {
  it('renders skill label and "Tidak Dinilai" badge with dashed styling', () => {
    render(<NotAssessedSkillCard skillLabel="GraphQL & Schema Stitching" />);

    expect(screen.getByText('GraphQL & Schema Stitching')).toBeInTheDocument();
    expect(screen.getByText('Tidak Dinilai')).toBeInTheDocument();
    expect(
      screen.getByText(/Skill ini tidak mendapat cukup pertanyaan probe selama sesi/i)
    ).toBeInTheDocument();
  });
});
