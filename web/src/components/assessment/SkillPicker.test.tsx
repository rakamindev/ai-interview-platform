import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SkillPicker from "@/components/assessment/SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";

vi.mock("@/services/skillTaxonomies", () => ({
    skillTaxonomiesApi: { list: vi.fn() },
}));

const TAXONOMY: SkillTaxonomy[] = [
    {
        skill_id: "skill-ruby",
        skill_label: "Ruby",
        category: "Engineering",
        scope_include: "Writes Ruby services.",
        scope_exclude: "",
        l1_anchor: "Recognises syntax.",
        l2_anchor: "Writes small scripts.",
        l3_anchor: "Ships a service change.",
        l4_anchor: "Designs boundaries.",
        l5_anchor: "Sets team practice.",
    },
    {
        skill_id: "skill-terraform",
        skill_label: "Terraform",
        category: "Platform",
        scope_include: "Manages infrastructure as code.",
        scope_exclude: "",
        l1_anchor: "Reads a plan.",
        l2_anchor: "Applies a change.",
        l3_anchor: "Owns a module.",
        l4_anchor: "Designs state layout.",
        l5_anchor: "Sets platform standards.",
    },
];

function renderPicker(onSelect = vi.fn(), onOpenChange = vi.fn()) {
    render(<SkillPicker open onOpenChange={onOpenChange} onSelect={onSelect} />);
    return { onSelect, onOpenChange };
}

describe("SkillPicker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
            data: { skill_taxonomies: TAXONOMY },
        } as never);
    });

    it("names its search field and filters the taxonomy by it", async () => {
        renderPicker();

        const search = screen.getByRole("textbox", { name: "Search skills" });
        expect(await screen.findByRole("button", { name: "Ruby" })).toBeInTheDocument();

        fireEvent.change(search, { target: { value: "terra" } });

        expect(screen.queryByRole("button", { name: "Ruby" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Terraform" })).toBeInTheDocument();
    });

    it("hands the taxonomy identity and anchors to the caller", async () => {
        const onOpenChange = vi.fn();
        const onSelect = vi.fn();
        renderPicker(onSelect, onOpenChange);

        fireEvent.click(await screen.findByRole("button", { name: "Ruby" }));

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                skill_id: "skill-ruby",
                skill_label: "Ruby",
                is_custom: false,
                scope_include: "Writes Ruby services.",
                l3_anchor: "Ships a service change.",
            })
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("says when the search matches nothing", async () => {
        renderPicker();

        fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), {
            target: { value: "zzzz" },
        });

        expect(await screen.findByText("No skills found.")).toBeInTheDocument();
    });
});
