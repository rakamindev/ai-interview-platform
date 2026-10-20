import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AssessorLayout from "@/components/layout/AssessorLayout";
import { authAtom } from "@/stores/authAtom";
import { tenantAtom } from "@/stores/tenantAtom";

function PathnameProbe() {
    const location = useLocation();
    return <p data-testid="pathname">{location.pathname}</p>;
}

function renderLayout(initialPath: string) {
    const store = createStore();
    store.set(authAtom, { token: "synthetic.jwt.token" });
    store.set(tenantAtom, { id: "tenant-7", name: "Acme Assessments" });

    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route element={<AssessorLayout />}>
                        <Route path="/assessments" element={<PathnameProbe />} />
                        <Route path="/vacancies" element={<PathnameProbe />} />
                    </Route>
                    <Route path="/login" element={<p>Login screen</p>} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
}

function navLinks() {
    const nav = screen.getByRole("navigation", { name: "Primary" });
    return {
        nav,
        assessments: within(nav).getByRole("link", { name: "Assessments" }),
        vacancies: within(nav).getByRole("link", { name: "Vacancies" }),
    };
}

describe("AssessorLayout", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("lists the assessor sections in the primary navigation", () => {
        renderLayout("/assessments");

        const { nav, assessments, vacancies } = navLinks();

        expect(within(nav).getAllByRole("link")).toHaveLength(2);
        expect(assessments).toHaveAttribute("href", "/assessments");
        expect(vacancies).toHaveAttribute("href", "/vacancies");
    });

    it("navigates to the section each nav link targets", () => {
        renderLayout("/assessments");

        const { assessments, vacancies } = navLinks();
        expect(screen.getByTestId("pathname")).toHaveTextContent("/assessments");

        fireEvent.click(vacancies);
        expect(screen.getByTestId("pathname")).toHaveTextContent("/vacancies");

        fireEvent.click(assessments);
        expect(screen.getByTestId("pathname")).toHaveTextContent("/assessments");
    });

    it("marks the active nav link with aria-current", () => {
        const first = renderLayout("/assessments");
        expect(navLinks().assessments).toHaveAttribute("aria-current", "page");
        expect(navLinks().vacancies).not.toHaveAttribute("aria-current");
        first.unmount();

        renderLayout("/vacancies");
        expect(navLinks().vacancies).toHaveAttribute("aria-current", "page");
        expect(navLinks().assessments).not.toHaveAttribute("aria-current");
    });

    it("shows the tenant name in the header pill", () => {
        renderLayout("/assessments");

        expect(screen.getByText("Tenant: Acme Assessments")).toBeInTheDocument();
    });

    it("clears the stored token and leaves the assessor area on logout", async () => {
        localStorage.setItem("auth_token", "stored.jwt.token");
        renderLayout("/assessments");

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open account menu" }));
        await user.click(await screen.findByRole("menuitem", { name: "Logout" }));

        expect(localStorage.getItem("auth_token")).toBeNull();
        expect(screen.getByText("Login screen")).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    });

    it("renders the routed screen inside its main region", () => {
        renderLayout("/assessments");

        expect(within(screen.getByRole("main")).getByTestId("pathname")).toHaveTextContent(
            "/assessments"
        );
    });
});
