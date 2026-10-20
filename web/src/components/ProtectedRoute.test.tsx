import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { authAtom } from "@/stores/authAtom";

function renderAtSecret(token: string | null) {
    const store = createStore();
    store.set(authAtom, { token });

    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={["/secret"]}>
                <Routes>
                    <Route element={<ProtectedRoute />}>
                        <Route path="/secret" element={<p>Protected area</p>} />
                    </Route>
                    <Route path="/login" element={<p>Login screen</p>} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
}

describe("ProtectedRoute", () => {
    it("renders the nested route when a token is present", () => {
        renderAtSecret("synthetic.jwt.token");

        expect(screen.getByText("Protected area")).toBeInTheDocument();
        expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
    });

    it("redirects to /login and withholds the protected child without a token", () => {
        renderAtSecret(null);

        expect(screen.getByText("Login screen")).toBeInTheDocument();
        expect(screen.queryByText("Protected area")).not.toBeInTheDocument();
    });
});
