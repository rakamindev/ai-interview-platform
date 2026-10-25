import { useEffect, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider, useSetAtom } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { authAtom, clearToken } from "@/stores/authAtom";

function AuthHarness({ token }: { token: string | null }) {
  const setAuth = useSetAtom(authAtom);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuth({ token, email: token ? "admin@example.com" : null });
    setReady(true);
  }, [setAuth, token]);

  if (!ready) return null;

  return (
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<><div>Protected admin page</div><button onClick={() => { clearToken(); setAuth({ token: null, email: null }); }}>Log out</button></>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderProtectedRoute(token: string | null) {
  return render(
    <Provider>
      <AuthHarness token={token} />
    </Provider>
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("redirects users without a successful login token to /login", async () => {
    renderProtectedRoute(null);

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected admin page")).not.toBeInTheDocument();
  });

  it("redirects users when the stored token is empty", async () => {
    renderProtectedRoute("");

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected admin page")).not.toBeInTheDocument();
  });

  it("allows users with a successful login token to access protected pages", async () => {
    renderProtectedRoute("login-token");

    await waitFor(() => {
      expect(screen.getByText("Protected admin page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("removes access immediately after logout instead of restoring it on navigation", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderProtectedRoute("login-token");

    await waitFor(() => expect(screen.getByText("Protected admin page")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
    expect(screen.queryByText("Protected admin page")).not.toBeInTheDocument();
  });
});
