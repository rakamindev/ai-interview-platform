import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentEditPage from "./AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { get: vi.fn(), update: vi.fn() },
}));

const anchors = {
    scope_include: "Test scope",
    l1_anchor: "Level 1 behaviour", l2_anchor: "Level 2 behaviour", l3_anchor: "Level 3 behaviour",
    l4_anchor: "Level 4 behaviour", l5_anchor: "Level 5 behaviour",
};

const savedSkills = [
    { id: 5, skill_id: null, skill_label: "RESTful API Design", is_custom: true, expected_level: 3, display_order: 0, ...anchors },
    { id: 7, skill_id: null, skill_label: "Ruby on Rails", is_custom: true, expected_level: 2, display_order: 1, ...anchors },
];

function renderEditPage() {
    render(
        <MemoryRouter initialEntries={["/assessments/2/edit"]}>
            <Routes>
                <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("AssessmentEditPage", () => {
    beforeEach(() => {
        vi.mocked(assessmentsApi.get).mockResolvedValue({
            data: { assessment: { id: 2, name: "Jr. Backend Engineer", time_limit_min: 30, skills: savedSkills } },
        } as never);
        vi.mocked(assessmentsApi.update).mockResolvedValue({ data: {} } as never);
    });

    it("sends _destroy for a saved skill the assessor removed", async () => {
        renderEditPage();

        const removeButtons = await screen.findAllByRole("button", { name: "Remove skill" });
        await userEvent.click(removeButtons[1]);
        await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

        await waitFor(() => expect(assessmentsApi.update).toHaveBeenCalled());
        const payload = vi.mocked(assessmentsApi.update).mock.calls[0][1];
        expect(payload.assessment_skills_attributes).toContainEqual({ id: 7, _destroy: true });
        expect(payload.assessment_skills_attributes).toContainEqual(expect.objectContaining({ id: 5 }));
    });

    it("does not send an unsaved skill the assessor added and removed", async () => {
        renderEditPage();

        await screen.findAllByRole("button", { name: "Remove skill" });
        await userEvent.click(screen.getByRole("button", { name: /Add custom skill/ }));
        const removeButtons = screen.getAllByRole("button", { name: "Remove skill" });
        await userEvent.click(removeButtons[removeButtons.length - 1]);
        await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

        await waitFor(() => expect(assessmentsApi.update).toHaveBeenCalled());
        const payload = vi.mocked(assessmentsApi.update).mock.calls[0][1];
        expect(payload.assessment_skills_attributes.map((s) => s.id)).toEqual([5, 7]);
        expect(payload.assessment_skills_attributes.some((s) => s._destroy)).toBe(false);
    });

    it("shows the server error and keeps the assessor's input when saving is rejected", async () => {
        vi.mocked(assessmentsApi.update).mockRejectedValue({
            response: { data: { errors: [{ message: "Skill 'RESTful API Design' is listed more than once" }] } },
        });
        renderEditPage();

        const nameInput = await screen.findByLabelText(/Role title/);
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, "Senior Backend Engineer");
        await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

        expect(await screen.findByText("Skill 'RESTful API Design' is listed more than once")).toBeInTheDocument();
        expect(screen.getByLabelText(/Role title/)).toHaveValue("Senior Backend Engineer");
        expect(screen.getAllByRole("button", { name: "Remove skill" })).toHaveLength(2);
    });

    it("shows a rejected save in a dismissible alert", async () => {
        vi.mocked(assessmentsApi.update).mockRejectedValue({
            response: { data: { errors: [{ message: "Skill 'RESTful API Design' is listed more than once" }] } },
        });
        renderEditPage();

        await screen.findAllByRole("button", { name: "Remove skill" });
        await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Skill 'RESTful API Design' is listed more than once");

        await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("tells the assessor that skill names must be unique", async () => {
        renderEditPage();

        expect(await screen.findByText(/Each skill needs its own name/)).toBeInTheDocument();
    });
});
