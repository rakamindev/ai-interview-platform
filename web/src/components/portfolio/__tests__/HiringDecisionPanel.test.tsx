import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HiringDecisionPanel from '../HiringDecisionPanel';
import type { HiringDecision } from '@/services/hiringDecisions';

describe('HiringDecisionPanel', () => {
  it('renders all three decision buttons initially', () => {
    render(<HiringDecisionPanel portfolioId={1} />);

    expect(screen.getByText('Advance')).toBeInTheDocument();
    expect(screen.getByText('Hold')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Confirm Decision (Permanent)')).toBeDisabled();
  });

  it('shows rationale textarea when a decision is clicked and enforces 20 characters minimum', () => {
    render(<HiringDecisionPanel portfolioId={1} />);

    // Click "Advance"
    fireEvent.click(screen.getByText('Advance'));

    const textarea = screen.getByPlaceholderText(/Explain why this candidate is being advanced/i);
    expect(textarea).toBeInTheDocument();

    const submitBtn = screen.getByText('Confirm Decision (Permanent)');
    expect(submitBtn).toBeDisabled();

    // Type less than 20 characters
    fireEvent.change(textarea, { target: { value: 'Too short' } });
    expect(submitBtn).toBeDisabled();

    // Type 20 characters or more
    fireEvent.change(textarea, {
      target: { value: 'Candidate demonstrated outstanding understanding of systems architecture.' },
    });
    expect(submitBtn).toBeEnabled();
  });

  it('renders committed locked state when existing decision is present', () => {
    const existingDecision: HiringDecision = {
      id: 42,
      decision: 'advance',
      rationale: 'Candidate exceeded expectations with exceptional problem solving skills.',
      decided_by: 1,
      decided_at: '2026-09-06T12:00:00Z',
      is_immutable: true,
    };

    render(<HiringDecisionPanel portfolioId={1} existing={existingDecision} />);

    expect(screen.getByText('Hiring Decision')).toBeInTheDocument();
    expect(screen.getByText('Advance')).toBeInTheDocument();
    expect(screen.getByText(/Candidate exceeded expectations/)).toBeInTheDocument();
    expect(screen.getByText(/This decision is permanent and cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByText('Confirm Decision (Permanent)')).not.toBeInTheDocument();
  });

  it('transitions to locked state when existing decision prop updates asynchronously after refresh', () => {
    const { rerender } = render(<HiringDecisionPanel portfolioId={1} existing={null} />);

    // Initially shows decision form
    expect(screen.getByText('Advance')).toBeInTheDocument();
    expect(screen.getByText('Confirm Decision (Permanent)')).toBeInTheDocument();

    // Asynchronous fetch returns decision on page refresh
    const loadedDecision: HiringDecision = {
      id: 100,
      decision: 'hold',
      rationale: 'Candidate holds solid potential but needs further technical evaluation.',
      decided_by: 2,
      decided_at: '2026-09-06T14:30:00Z',
      is_immutable: true,
    };

    rerender(<HiringDecisionPanel portfolioId={1} existing={loadedDecision} />);

    // Now renders locked state
    expect(screen.getByText('Hold')).toBeInTheDocument();
    expect(screen.getByText(/needs further technical evaluation/)).toBeInTheDocument();
    expect(screen.getByText(/This decision is permanent and cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByText('Confirm Decision (Permanent)')).not.toBeInTheDocument();
  });
});
