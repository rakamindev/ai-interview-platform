import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createStore, Provider } from "jotai";
import ProtectedRoute from "../ProtectedRoute";
import { authAtom, clearToken } from "@/stores/authAtom";

describe("ProtectedRoute - Authentication Guard", () => {
  beforeEach(() => {
    clearToken();
  });

  it("redirects unauthenticated users to /login when no token exists", () => {
    const testStore = createStore();
    testStore.set(authAtom, { token: null });

    render(
      <Provider store={testStore}>
        <MemoryRouter initialEntries={["/assessments"]}>
          <Routes>
            <Route path="/login" element={<div>Login Page Guard</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/assessments" element={<div>Protected Assessments</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.queryByText("Protected Assessments")).toBeNull();
    expect(screen.getByText("Login Page Guard")).toBeInTheDocument();
  });

  it("renders protected content when a valid token is present", () => {
    const testStore = createStore();
    testStore.set(authAtom, { token: "valid-jwt-token" });

    render(
      <Provider store={testStore}>
        <MemoryRouter initialEntries={["/assessments"]}>
          <Routes>
            <Route path="/login" element={<div>Login Page Guard</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/assessments" element={<div>Protected Assessments</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText("Protected Assessments")).toBeInTheDocument();
    expect(screen.queryByText("Login Page Guard")).toBeNull();
  });
});
