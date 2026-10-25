import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OverridePanel from './OverridePanel';
import { portfoliosApi } from '@/services/portfolios';

vi.mock('@/services/portfolios', () => ({
    portfoliosApi: {
        getOverride: vi.fn()
    }
}));

// Mock LevelBadge component
vi.mock('./LevelBadge', () => ({
    default: ({ level }: { level: number }) => <div data-testid="level-badge">{level}</div>
}));

// Mock LevelRadio component
vi.mock('@/components/assessment/LevelRadio', () => ({
    default: ({ value, onChange }: { value: number, onChange: any }) => (
        <div data-testid="level-radio">
            Current: {value}
            <button onClick={() => onChange(5)}>Set to 5</button>
        </div>
    )
}));

describe('OverridePanel Component', () => {
    const mockSkill = {
        id: 1,
        skill_id: 10,
        skill_label: 'Python',
        ai_level: 3,
        ai_confidence: 'high'
    };

    const mockOnSaved = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial state with button', () => {
        render(<OverridePanel skill={mockSkill as any} onSaved={mockOnSaved} />);
        expect(screen.getByRole('button', { name: /Override rating/i })).toBeInTheDocument();
    });

    it('renders existing override data when provided', () => {
        const existingOverride = { override_level: 5, assessor_notes: 'Great answers' };
        render(<OverridePanel skill={mockSkill as any} existingOverride={existingOverride as any} onSaved={mockOnSaved} />);

        expect(screen.getAllByTestId('level-badge')).toHaveLength(2);
        expect(screen.getByText(/You Overridden/i)).toBeInTheDocument();
    });

    it('opens panel, edits override, and saves successfully', async () => {
        (portfoliosApi.getOverride as any).mockResolvedValue({
            data: { override: { override_level: 5, assessor_notes: 'Expert in Python' } }
        });

        render(<OverridePanel skill={mockSkill as any} onSaved={mockOnSaved} />);

        // Open panel
        fireEvent.click(screen.getByRole('button', { name: /Override rating/i }));

        expect(screen.getByTestId('level-radio')).toBeInTheDocument();

        // Change rating using mock button
        fireEvent.click(screen.getByText('Set to 5'));

        // Change notes
        const textarea = screen.getByPlaceholderText(/Add context for your override/i);
        fireEvent.change(textarea, { target: { value: 'Expert in Python' } });

        // Save
        fireEvent.click(screen.getByRole('button', { name: /Save override/i }));

        expect(portfoliosApi.getOverride).toHaveBeenCalledWith(1, {
            override_level: 5,
            assessor_notes: 'Expert in Python'
        });

        await waitFor(() => {
            expect(mockOnSaved).toHaveBeenCalledWith(expect.objectContaining({
                override_level: 5,
                assessor_notes: 'Expert in Python'
            }));
        });
    });

    it('displays error message when saving fails', async () => {
        (portfoliosApi.getOverride as any).mockRejectedValue(new Error('Network error'));

        render(<OverridePanel skill={mockSkill as any} onSaved={mockOnSaved} />);

        fireEvent.click(screen.getByRole('button', { name: /Override rating/i }));
        fireEvent.click(screen.getByRole('button', { name: /Save override/i }));

        await waitFor(() => {
            expect(screen.getByText(/Failed to save override/i)).toBeInTheDocument();
        });
    });
});
