import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Provider, createStore } from "jotai";
import ProtectedRoute from "@/components/ProtectedRoute";
import { authAtom } from "@/stores/authAtom";

function renderGuarded(role: string | null) {
    const store = createStore();
    store.set(authAtom, { token: role ? "test-token" : null, role, email: null });

    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={["/assessments"]}>
                <Routes>
                    <Route element={<ProtectedRoute roles={["admin"]} />}>
                        <Route path="/assessments" element={<div>assessor workspace</div>} />
                    </Route>
                    <Route path="/candidate" element={<div>candidate home</div>} />
                    <Route path="/login" element={<div>login page</div>} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
}

describe("ProtectedRoute", () => {
    it("sends anonymous visitors to the login page", () => {
        renderGuarded(null);

        expect(screen.getByText("login page")).toBeInTheDocument();
    });

    it("lets the admin superuser into the assessor workspace", () => {
        renderGuarded("admin");

        expect(screen.getByText("assessor workspace")).toBeInTheDocument();
    });

    it("keeps a candidate token out of assessor routes", () => {
        renderGuarded("user");

        expect(screen.getByText("candidate home")).toBeInTheDocument();
        expect(screen.queryByText("assessor workspace")).not.toBeInTheDocument();
    });
});
