import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoiceBars from './VoiceBars';

describe('VoiceBars Monozukuri Audio Visualizer', () => {
  it('renders label and status role properly for accessibility', () => {
    render(<VoiceBars active={true} label="AI speaking" variant="ai" />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute('aria-label', 'AI speaking (aktif)');
    expect(screen.getByText('AI speaking')).toBeInTheDocument();
  });

  it('renders idle state when active is false', () => {
    render(<VoiceBars active={false} label="Listening..." variant="ai" />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-label', 'Listening... (siaga)');
  });

  it('supports candidate variant with distinct styling', () => {
    render(<VoiceBars active={true} label="You're speaking" variant="candidate" />);

    expect(screen.getByText("You're speaking")).toBeInTheDocument();
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-label', "You're speaking (aktif)");
  });
});
