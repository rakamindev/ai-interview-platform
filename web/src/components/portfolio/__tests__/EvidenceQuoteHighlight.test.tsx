import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EvidenceQuoteHighlight from '../EvidenceQuoteHighlight';

describe('EvidenceQuoteHighlight', () => {
  it('returns null if quotes array is empty', () => {
    const { container } = render(<EvidenceQuoteHighlight quotes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders initial visible quotes and shows expansion button when more exist', async () => {
    const quotes = [
      'I usually optimize Postgres queries using EXPLAIN ANALYZE.',
      'We set up composite indexes on frequently filtered columns.',
      'Connection pooling with PgBouncer prevented connection spikes.',
    ];

    render(<EvidenceQuoteHighlight quotes={quotes} maxVisible={1} />);

    expect(screen.getByText(quotes[0])).toBeInTheDocument();
    expect(screen.queryByText(quotes[1])).not.toBeInTheDocument();
    expect(screen.getByText('+2 kutipan lagi')).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('+2 kutipan lagi'));

    expect(screen.getByText(quotes[1])).toBeInTheDocument();
    expect(screen.getByText(quotes[2])).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Sembunyikan')).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(screen.getByText('Sembunyikan'));
    expect(screen.queryByText(quotes[1])).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('+2 kutipan lagi')).toBeInTheDocument();
    });
  });
});
