import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CandidateLayout from "@/components/layout/CandidateLayout";

function renderLayout() {
    return render(
        <MemoryRouter initialEntries={["/candidate/interview"]}>
            <Routes>
                <Route element={<CandidateLayout />}>
                    <Route path="/candidate/interview" element={<p>Interview screen</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("CandidateLayout", () => {
    it("renders the routed candidate screen", () => {
        renderLayout();

        expect(screen.getByText("Interview screen")).toBeInTheDocument();
    });

    it("exposes no assessor navigation to the candidate", () => {
        renderLayout();

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("offers no logout affordance", () => {
        renderLayout();

        expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
    });

    it("keeps the routed screen inside its main region", () => {
        renderLayout();

        expect(within(screen.getByRole("main")).getByText("Interview screen")).toBeInTheDocument();
    });
});
