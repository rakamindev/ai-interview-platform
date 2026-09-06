import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkillLevelBadge from '../SkillLevelBadge';

describe('SkillLevelBadge', () => {
  it('renders L1 with fundamental label and zinc styles', () => {
    render(<SkillLevelBadge level={1} />);
    const badge = screen.getByText('L1 · Fundamental');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-zinc-100');
    expect(badge.className).toContain('text-zinc-600');
  });

  it('renders L3 with proficient label and emerald styles', () => {
    render(<SkillLevelBadge level={3} size="md" />);
    const badge = screen.getByText('L3 · Proficient');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-emerald-50');
    expect(badge.className).toContain('text-emerald-700');
  });

  it('renders L5 with expert label and amber styles', () => {
    render(<SkillLevelBadge level={5} />);
    const badge = screen.getByText('L5 · Expert');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-amber-50');
    expect(badge.className).toContain('text-amber-700');
  });

  it('handles unknown level gracefully', () => {
    render(<SkillLevelBadge level={99} />);
    expect(screen.getByText('L99')).toBeInTheDocument();
  });
});
