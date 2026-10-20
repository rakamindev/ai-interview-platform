import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { assessment, assessmentWithSkills, skillTaxonomies } from "../fixtures";

type Sent = { assessment: { name: string; time_limit_min: number; language?: string; proctoring_required?: boolean; assessment_skills_attributes: Array<Record<string, unknown>> } };

// The invite page the forms navigate to after a save.
function serveInvitePage() {
  server.use(
    http.get(`${API}/assessments/7`, () => HttpResponse.json(assessmentWithSkills)),
    http.get(`${API}/assessments/7/sessions`, () => HttpResponse.json({ sessions: [] }))
  );
}

describe("Creating an assessment", () => {
  function serveCreate(onCreate: (body: Sent) => void) {
    serveInvitePage();
    server.use(
      http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)),
      http.post(`${API}/assessments`, async ({ request }) => {
        onCreate((await request.json()) as Sent);
        return HttpResponse.json({ assessment, system_prompt_generated: true }, { status: 201 });
      })
    );
  }

  it("saves the role, defaults and a library skill, then opens the invite page", async () => {
    let sent: Sent | undefined;
    serveCreate((body) => (sent = body));
    const { user } = renderApp("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    await user.click(await screen.findByRole("button", { name: "React" }));
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
    expect(sent?.assessment).toMatchObject({ name: "Senior Frontend Engineer", time_limit_min: 45, language: "en",
                                             proctoring_required: false });
    expect(sent?.assessment.assessment_skills_attributes).toEqual([
      expect.objectContaining({ skill_label: "React", is_custom: false, expected_level: 3, display_order: 0,
                                l3_anchor: "Handles ambiguity and trade-offs." }),
    ]);
  });

  it("requires camera and full-screen sharing when the assessor turns it on", async () => {
    let sent: Sent | undefined;
    serveCreate((body) => (sent = body));
    const { user } = renderApp("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Senior Frontend Engineer");
    await user.click(screen.getByRole("checkbox", { name: /Require camera and full-screen sharing/ }));
    await user.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    await user.click(await screen.findByRole("button", { name: "React" }));
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
    expect(sent?.assessment.proctoring_required).toBe(true);
  });

  it("saves a custom skill with its scope, anchors and the expected level picked", async () => {
    let sent: Sent | undefined;
    serveCreate((body) => (sent = body));
    const { user } = renderApp("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Data Analyst");
    await user.click(screen.getByRole("button", { name: /Add custom skill/ }));
    await user.type(screen.getByLabelText(/^Name/), "SQL");
    await user.type(screen.getByLabelText(/What counts/), "Joins, window functions");
    for (const level of [1, 2, 3, 4, 5]) await user.type(screen.getByLabelText(new RegExp(`L${level} anchor`)), `Level ${level}`);
    await user.click(screen.getAllByRole("radio")[3]);
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    await screen.findByRole("heading", { name: "Senior Frontend Engineer" });
    expect(sent?.assessment.assessment_skills_attributes).toEqual([
      expect.objectContaining({ skill_label: "SQL", is_custom: true, scope_include: "Joins, window functions",
                                l1_anchor: "Level 1", l5_anchor: "Level 5", expected_level: 4 }),
    ]);
  });

  it("asks for a role title and at least one skill before saving", async () => {
    let posted = false;
    serveCreate(() => (posted = true));
    const { user } = renderApp("/assessments/new");

    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));
    expect(await screen.findByText("Role title is required")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Role title/), "Data Analyst");
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    expect(await screen.findAllByText("Add at least one skill to continue.")).toHaveLength(2);
    expect(posted).toBe(false);
  });

  it("shows the API's reason when the save is rejected", async () => {
    server.use(
      http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)),
      http.post(`${API}/assessments`, () =>
        HttpResponse.json({ errors: [{ status: 422, message: "Time limit min is not included in the list" }] }, { status: 422 })
      )
    );
    const { user } = renderApp("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Data Analyst");
    await user.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    await user.click(await screen.findByRole("button", { name: "React" }));
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    expect(await screen.findByText("Time limit min is not included in the list")).toBeInTheDocument();
  });

  describe("known defects", () => {
    // The custom skill fields are `required: true` with no message, so the save button silently does nothing.
    it.fails("P2-16: says which custom skill fields are missing", async () => {
      serveCreate(() => {});
      const { user } = renderApp("/assessments/new");

      await user.type(screen.getByLabelText(/Role title/), "Data Analyst");
      await user.click(screen.getByRole("button", { name: /Add custom skill/ }));
      await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

      expect(await screen.findByText(/required/i)).toBeInTheDocument();
    });
  });
});

describe("Editing an assessment", () => {
  function serveEdit(onUpdate: (body: Sent) => void) {
    serveInvitePage();
    server.use(
      http.put(`${API}/assessments/7`, async ({ request }) => {
        onUpdate((await request.json()) as Sent);
        return HttpResponse.json({ assessment: assessmentWithSkills.assessment, system_prompt_generated: true });
      })
    );
  }

  it("loads the assessment, saves the changes with each skill's id, and opens the invite page", async () => {
    let sent: Sent | undefined;
    serveEdit((body) => (sent = body));
    const { user } = renderApp("/assessments/7/edit");

    const name = await screen.findByLabelText(/Role title/);
    expect(name).toHaveValue("Senior Frontend Engineer");
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Staff Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
    expect(sent?.assessment.name).toBe("Staff Frontend Engineer");
    expect(sent?.assessment.assessment_skills_attributes).toEqual([
      expect.objectContaining({ id: 11, skill_label: "React", display_order: 0 }),
      expect.objectContaining({ id: 12, skill_label: "Communication", display_order: 1 }),
    ]);
  });

  describe("known defects", () => {
    // The removed skill is just left out of assessment_skills_attributes; nested attributes only delete a row
    // sent with `_destroy`, so the skill stays on the assessment and the interviewer still asks about it.
    it.fails("P1-14: tells the API to delete a skill the assessor removed", async () => {
      let sent: Sent | undefined;
      serveEdit((body) => (sent = body));
      const { user } = renderApp("/assessments/7/edit");

      await screen.findByText("Communication");
      await user.click(screen.getAllByRole("button", { name: "Remove skill" })[1]);
      await user.click(screen.getByRole("button", { name: /Save/ }));
      await screen.findByRole("heading", { name: "Senior Frontend Engineer" });

      expect(sent?.assessment.assessment_skills_attributes).toContainEqual(
        expect.objectContaining({ id: 12, _destroy: true })
      );
    });

    // A failed load is swallowed (`.catch(() => {})`) and leaves an empty form that can be saved over the assessment.
    it.fails("P2-17: says the assessment couldn't be loaded instead of showing an empty form", async () => {
      server.use(http.get(`${API}/assessments/7`, () => HttpResponse.json({}, { status: 500 })));
      renderApp("/assessments/7/edit");

      expect(await screen.findByText(/couldn't load|failed to load/i)).toBeInTheDocument();
    });
  });
});

