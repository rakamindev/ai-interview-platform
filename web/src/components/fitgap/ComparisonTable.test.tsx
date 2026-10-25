import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ComparisonTable from './ComparisonTable';

// Mock specific utility labels mapping
vi.mock('@/utils/constants', () => ({
    LEVEL_LABELS: { 1: 'Beginner', 3: 'Mid', 5: 'Expert' },
    FIT_GAP_RESULT_LABELS: {
        match: 'Match',
        gap: 'Gap',
        exceed: 'Exceed',
        not_assessed: 'N/A'
    },
    FIT_GAP_RESULT_CLASSES: {
        match: 'text-green-500',
        gap: 'text-red-500',
        exceed: 'text-blue-500'
    }
}));

describe('ComparisonTable Component', () => {
    it('renders table headers correctly', () => {
        render(<ComparisonTable comparisons={[]} />);
        expect(screen.getByText('Skill')).toBeInTheDocument();
        expect(screen.getByText('Required')).toBeInTheDocument();
        expect(screen.getByText('Candidate')).toBeInTheDocument();
        expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('renders skill comparisons displaying results, gaps, and exceeds', () => {
        const mockComparisons = [
            { skill_label: 'TypeScript', required_level: 3, candidate_level: 3, result: 'match', delta: 0, is_override: false },
            { skill_label: 'NodeJS', required_level: 5, candidate_level: 3, result: 'gap', delta: -2, is_override: false },
            { skill_label: 'AWS', required_level: 1, candidate_level: 3, result: 'exceed', delta: 2, is_override: true }
        ];

        render(<ComparisonTable comparisons={mockComparisons as any} />);

        // Test Table Cell Content
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(screen.getByText('NodeJS')).toBeInTheDocument();
        expect(screen.getByText('AWS')).toBeInTheDocument();

        // The component includes the delta count inside suffix, check visually if labels are generated
        expect(screen.getAllByText('Mid').length).toBeGreaterThan(0); // Multiple candidates are Mid 

        // Results Column
        expect(screen.getAllByText(/Match/)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Gap/)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Exceed/)[0]).toBeInTheDocument();
        expect(screen.getByText(/-2/)).toBeInTheDocument();

        // Test Summary footer counts
        expect(screen.getByText(/Match: 1/)).toBeInTheDocument();
        expect(screen.getByText(/Gap: 1/)).toBeInTheDocument();
        expect(screen.getByText(/Exceeds: 1/)).toBeInTheDocument();
    });
});
