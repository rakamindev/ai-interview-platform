import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { assessmentList } from "../fixtures";

describe("Assessment list", () => {
  it("lists the assessor's assessments with their time limit and latest session", async () => {
    server.use(
      http.get(`${API}/assessments`, () =>
        HttpResponse.json(
          assessmentList([
            { name: "Senior Frontend Engineer", time_limit_min: 45, latest_session: { id: 1, status: "active", end_reason: null } },
            { name: "Data Analyst", time_limit_min: 30, latest_session: { id: 2, status: "pending", end_reason: null } },
            { name: "Backend Engineer", time_limit_min: 60, latest_session: { id: 3, status: "ended", end_reason: "error" } },
          ])
        )
      )
    );
    renderApp("/assessments");

    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText("Awaiting candidate")).toBeInTheDocument();
    expect(screen.getByText("Last: failed")).toBeInTheDocument();
  });

  it("invites the assessor to create a first assessment when there are none", async () => {
    server.use(http.get(`${API}/assessments`, () => HttpResponse.json(assessmentList([]))));
    renderApp("/assessments");

    expect(await screen.findByText("No assessments yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create your first assessment/ })).toBeInTheDocument();
  });

  describe("known defects (assessment/03-problem-and-gap.md)", () => {
    // `it.fails` passes only while the test fails. When the defect is fixed it
    // starts failing; change it to `it` in the same commit as the fix.
    it.fails("P2-6: shows only the error when loading fails, not the empty state too", async () => {
      server.use(http.get(`${API}/assessments`, () => HttpResponse.json({}, { status: 500 })));
      renderApp("/assessments");

      expect(await screen.findByText(/Failed to load assessments/)).toBeInTheDocument();
      expect(screen.queryByText("No assessments yet.")).not.toBeInTheDocument();
    });

    it.fails("P1-9: does not report a session the candidate ended early as completed", async () => {
      server.use(
        http.get(`${API}/assessments`, () =>
          HttpResponse.json(
            assessmentList([{ name: "Senior Frontend Engineer", latest_session: { id: 1, status: "ended", end_reason: "manual_candidate" } }])
          )
        )
      );
      renderApp("/assessments");

      expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
      expect(screen.queryByText("Last: completed")).not.toBeInTheDocument();
    });

    it.fails("P1-8: lets the assessor reach assessments beyond the first page", async () => {
      server.use(
        http.get(`${API}/assessments`, () =>
          HttpResponse.json(assessmentList(Array.from({ length: 20 }, (_, i) => ({ name: `Role ${i + 1}` })), 25))
        )
      );
      renderApp("/assessments");

      expect(await screen.findByText("Role 1")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next|page 2|load more/i })).toBeInTheDocument();
    });
  });
});
