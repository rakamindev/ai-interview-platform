import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { createStore } from "jotai";
import { renderWithProviders } from "@/test/utils";
import AssessorLayout from "./AssessorLayout";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom } from "@/stores/authAtom";

const meMock = vi.hoisted(() => vi.fn());
const liveMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/auth", () => ({
  authApi: { me: meMock },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { live: liveMock },
}));

function renderLayout(store: ReturnType<typeof createStore>) {
  return renderWithProviders(
    <Routes>
      <Route element={<AssessorLayout />}>
        <Route path="/assessments" element={<div>Assessments page</div>} />
      </Route>
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route: "/assessments", store },
  );
}

describe("AssessorLayout", () => {
  beforeEach(() => {
    meMock.mockReset();
    liveMock.mockReset();
    localStorage.clear();
  });

  it("renders navigation, tenant chip and the outlet", async () => {
    const store = createStore();
    store.set(tenantAtom, { id: "1", name: "Acme" });
    store.set(authAtom, { token: "t" });
    liveMock.mockResolvedValue({ data: { sessions: [] } });
    meMock.mockResolvedValue({ data: { user: { email: "a@b.c" } } });
    renderLayout(store);

    expect(screen.getByText("Assessments")).toBeInTheDocument();
    expect(screen.getByText("Vacancies")).toBeInTheDocument();
    expect(screen.getByText("Tenant: Acme")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("a@b.c")).toBeInTheDocument());
    expect(screen.getByText("Assessments page")).toBeInTheDocument();
  });

  it("shows the live-sessions pill linking to the monitor", async () => {
    const store = createStore();
    store.set(tenantAtom, { id: "1", name: "" });
    store.set(authAtom, { token: "t" });
    liveMock.mockResolvedValue({
      data: {
        sessions: [
          { id: 55, assessment_id: 7 },
          { id: 56, assessment_id: 7 },
        ],
      },
    });
    meMock.mockResolvedValue({ data: { user: { role: "admin" } } });
    renderLayout(store);

    const pill = await screen.findByText("2 live");
    expect(pill.closest("a")).toHaveAttribute("href", "/assessments/7/sessions/55/monitor");
    await waitFor(() => expect(screen.getByText("Role: admin")).toBeInTheDocument());
  });

  it("does not render the live pill without sessions", async () => {
    const store = createStore();
    store.set(tenantAtom, { id: "1", name: "" });
    store.set(authAtom, { token: "t" });
    liveMock.mockResolvedValue({ data: { sessions: [] } });
    meMock.mockResolvedValue({ data: { user: { email: "x@y.z" } } });
    renderLayout(store);
    await waitFor(() => expect(screen.queryByText(/live/)).not.toBeInTheDocument());
  });

  it("logs out by clearing the token and navigating to /login", async () => {
    const store = createStore();
    store.set(tenantAtom, { id: "1", name: "" });
    store.set(authAtom, { token: "t" });
    localStorage.setItem("auth_token", "t");
    liveMock.mockResolvedValue({ data: { sessions: [] } });
    meMock.mockResolvedValue({ data: { user: { role: "admin" } } });
    renderLayout(store);

    fireEvent.click(screen.getByText("Logout"));
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
});
