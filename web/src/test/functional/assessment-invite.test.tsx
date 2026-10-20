import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { assessmentSessions, assessmentWithSkills, session } from "../fixtures";

function serveInvitePage(sessions = assessmentSessions) {
  server.use(
    http.get(`${API}/assessments/7`, () => HttpResponse.json(assessmentWithSkills)),
    http.get(`${API}/assessments/7/sessions`, () => HttpResponse.json(sessions))
  );
}

// The candidate's row in the list (the name can also appear in the new-link banner).
const rowOf = (name: string) =>
  screen.getAllByText(name).map((el) => el.closest("div.flex.items-center.justify-between")).find(Boolean) as HTMLElement;

describe("Inviting candidates", () => {
  it("shows the assessment and where each candidate is", async () => {
    serveInvitePage();
    renderApp("/assessments/7/invite");

    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
    expect(screen.getByText(/45 min · 2 skills/)).toBeInTheDocument();

    expect(within(rowOf("Budi Santoso")).getByText("Awaiting candidate")).toBeInTheDocument();
    expect(within(rowOf("Budi Santoso")).getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
    expect(within(rowOf("Sari Wijaya")).getByRole("button", { name: /Monitor/ })).toBeInTheDocument();
    expect(within(rowOf("Test Candidate")).getByText("Completed")).toBeInTheDocument();
    expect(within(rowOf("Test Candidate")).getByRole("button", { name: /Results/ })).toBeInTheDocument();
    expect(within(rowOf("Dewi Lestari")).getByText("Failed")).toBeInTheDocument();
    expect(within(rowOf("Dewi Lestari")).queryByRole("button", { name: /Results/ })).not.toBeInTheDocument();
  });

  it("creates a named invite link and copies it", async () => {
    serveInvitePage({ sessions: [] });
    let sent: unknown;
    const created = { ...session, id: 45, candidate_name: "Rina Putri", status: "pending", end_reason: null, started_at: null,
                      invite_url: "http://localhost:5173/interview/tok-new" };
    server.use(
      http.post(`${API}/assessments/7/sessions`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ session: created, invite_url: created.invite_url }, { status: 201 });
      })
    );
    const { user } = renderApp("/assessments/7/invite");

    expect(await screen.findByText("No candidates yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    await user.type(screen.getByLabelText("Candidate name"), "  Rina Putri ");
    await user.click(screen.getByRole("button", { name: "Create Link" }));

    expect(await screen.findByText(/ready — share with your candidate/)).toBeInTheDocument();
    expect(sent).toEqual({ session: { candidate_name: "Rina Putri" } });
    expect(screen.getAllByText("http://localhost:5173/interview/tok-new").length).toBeGreaterThan(0);
    expect(within(rowOf("Rina Putri")).getByText("Awaiting candidate")).toBeInTheDocument();

    // The banner's button comes first; the new row has its own.
    await user.click(screen.getAllByRole("button", { name: "Copy link" })[0]);

    expect(await navigator.clipboard.readText()).toBe("http://localhost:5173/interview/tok-new");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("creates an unnamed link when the name is left blank", async () => {
    serveInvitePage({ sessions: [] });
    let sent: unknown;
    server.use(
      http.post(`${API}/assessments/7/sessions`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ session: { ...session, id: 46, candidate_name: null, status: "pending" } }, { status: 201 });
      })
    );
    const { user } = renderApp("/assessments/7/invite");

    await user.click(await screen.findByRole("button", { name: /Invite Candidate/ }));
    await user.click(screen.getByRole("button", { name: "Create Link" }));

    expect(await screen.findByText(/New invite link ready/)).toBeInTheDocument();
    expect(sent).toEqual({ session: {} });
  });

  describe("known defects", () => {
    // Both loads are swallowed (`.catch(() => {})`): the page reads "—" and "No candidates yet", so the assessor
    // thinks nobody was invited.
    it.fails("P2-17: says the assessment couldn't be loaded instead of 'No candidates yet'", async () => {
      server.use(
        http.get(`${API}/assessments/7`, () => HttpResponse.json({}, { status: 500 })),
        http.get(`${API}/assessments/7/sessions`, () => HttpResponse.json({}, { status: 500 }))
      );
      renderApp("/assessments/7/invite");

      expect(await screen.findByText(/couldn't load|failed to load/i)).toBeInTheDocument();
      expect(screen.queryByText("No candidates yet")).not.toBeInTheDocument();
    });
  });
});
