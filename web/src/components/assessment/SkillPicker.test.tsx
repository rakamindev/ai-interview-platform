import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SkillPicker from './SkillPicker';
import { skillTaxonomiesApi } from '@/services/skillTaxonomies';

vi.mock('@/services/skillTaxonomies', () => ({
    skillTaxonomiesApi: {
        list: vi.fn()
    }
}));

describe('SkillPicker Component', () => {
    const mockOnOpenChange = vi.fn();
    const mockOnSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when not open', () => {
        render(<SkillPicker open={false} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect} />);
        expect(screen.queryByText(/Add from B7 taxonomy/i)).not.toBeInTheDocument();
    });

    it('fetches and displays skills accurately when open', async () => {
        const mockSkills = {
            data: {
                skill_taxonomies: [
                    { skill_id: 1, skill_label: 'React', scope_include: 'React hooks', l1_anchor: 'A', l2_anchor: 'B', l3_anchor: 'C', l4_anchor: 'D', l5_anchor: 'E' },
                    { skill_id: 2, skill_label: 'Vue', scope_include: 'Vue composition api', l1_anchor: 'A', l2_anchor: 'B', l3_anchor: 'C', l4_anchor: 'D', l5_anchor: 'E' }
                ]
            }
        };
        (skillTaxonomiesApi.list as any).mockResolvedValue(mockSkills);

        render(<SkillPicker open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect} />);

        expect(screen.getByText(/Add from B7 taxonomy/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('React')).toBeInTheDocument();
            expect(screen.getByText('Vue')).toBeInTheDocument();
        });
    });

    it('filters skills based on search query', async () => {
        const mockSkills = {
            data: {
                skill_taxonomies: [
                    { skill_id: 1, skill_label: 'React', scope_include: '' },
                    { skill_id: 2, skill_label: 'Node', scope_include: '' }
                ]
            }
        };
        (skillTaxonomiesApi.list as any).mockResolvedValue(mockSkills);

        render(<SkillPicker open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect} />);

        await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText(/Search skills/i);
        fireEvent.change(searchInput, { target: { value: 'nod' } });

        expect(screen.queryByText('React')).not.toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();
    });

    it('triggers onSelect when a skill is clicked', async () => {
        const mockSkills = {
            data: {
                skill_taxonomies: [
                    { skill_id: 1, skill_label: 'Ruby', scope_include: 'Rails' }
                ]
            }
        };
        (skillTaxonomiesApi.list as any).mockResolvedValue(mockSkills);

        render(<SkillPicker open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect} />);

        await waitFor(() => expect(screen.getByText('Ruby')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Ruby'));

        expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({
            skill_label: 'Ruby',
            is_custom: false
        }));
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
});
