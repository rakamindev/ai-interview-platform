import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { skillTaxonomies, vacancies, vacancyWithSkills } from "../fixtures";

type Sent = { vacancy: { role_title: string; culture_dimensions: string; competency_expectations: string;
                         vacancy_skills_attributes: Array<Record<string, unknown>> } };

const serveList = (body: object = vacancies) => server.use(http.get(`${API}/vacancies`, () => HttpResponse.json(body)));
const empty = { vacancies: [], meta: { current_page: 1, total_pages: 1, total_count: 0, per_page: 20 } };

describe("Vacancy list", () => {
  it("lists the vacancies and opens one for editing", async () => {
    serveList();
    server.use(http.get(`${API}/vacancies/5`, () => HttpResponse.json(vacancyWithSkills)));
    const { user } = renderApp("/vacancies");

    await user.click(await screen.findByText("Senior Frontend Engineer (TechCorp)"));

    expect(await screen.findByDisplayValue("Senior Frontend Engineer (TechCorp)")).toBeInTheDocument();
  });

  it("invites the assessor to create a first vacancy when there are none", async () => {
    serveList(empty);
    renderApp("/vacancies");

    expect(await screen.findByText("No vacancies yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create your first vacancy/ })).toBeInTheDocument();
  });

  describe("known defects", () => {
    // Same shape as P2-6 on the assessment list: `error` and the empty state are checked separately.
    it.fails("P2-6: shows only the error when loading fails, not the empty state too", async () => {
      server.use(http.get(`${API}/vacancies`, () => HttpResponse.json({}, { status: 500 })));
      renderApp("/vacancies");

      expect(await screen.findByText(/Failed to load vacancies/)).toBeInTheDocument();
      expect(screen.queryByText("No vacancies yet.")).not.toBeInTheDocument();
    });
  });
});

describe("Creating a vacancy", () => {
  it("saves the role, culture, expectations and each skill's expected level", async () => {
    let sent: Sent | undefined;
    serveList();
    server.use(
      http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)),
      http.post(`${API}/vacancies`, async ({ request }) => {
        sent = (await request.json()) as Sent;
        return HttpResponse.json({ vacancy: vacancyWithSkills.vacancy }, { status: 201 });
      })
    );
    const { user } = renderApp("/vacancies/new");

    await user.type(screen.getByLabelText(/Role title/), "Senior Frontend Engineer (TechCorp)");
    await user.click(screen.getByRole("button", { name: /Add skill expectation/ }));
    await user.click(await screen.findByRole("button", { name: "React" }));
    await user.click(screen.getAllByRole("radio")[3]);
    await user.type(screen.getByLabelText(/Company culture/), "Ownership-driven");
    await user.type(screen.getByLabelText(/Competency expectations/), "Strong communicator");
    await user.click(screen.getByRole("button", { name: "Save Vacancy" }));

    // Wait for the list's rows, not just its heading, so its request finishes inside this test.
    expect(await screen.findByRole("heading", { name: "Vacancies" })).toBeInTheDocument();
    expect(await screen.findByText("Senior Frontend Engineer (TechCorp)")).toBeInTheDocument();
    expect(sent?.vacancy).toMatchObject({
      role_title: "Senior Frontend Engineer (TechCorp)",
      culture_dimensions: "Ownership-driven",
      competency_expectations: "Strong communicator",
    });
    expect(sent?.vacancy.vacancy_skills_attributes).toEqual([
      expect.objectContaining({ skill_label: "React", expected_level: 4 }),
    ]);
  });

  it("shows the API's reason when the save is rejected", async () => {
    server.use(
      http.post(`${API}/vacancies`, () =>
        HttpResponse.json({ errors: [{ status: 422, message: "Role title is too long" }] }, { status: 422 })
      )
    );
    const { user } = renderApp("/vacancies/new");

    await user.type(screen.getByLabelText(/Role title/), "x");
    await user.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("Role title is too long")).toBeInTheDocument();
  });

  describe("known defects", () => {
    // `required: true` with no message: an empty role title makes Save silently do nothing.
    it.fails("P2-16: says the role title is required", async () => {
      const { user } = renderApp("/vacancies/new");

      await user.click(screen.getByRole("button", { name: "Save Vacancy" }));

      expect(await screen.findByText(/required/i)).toBeInTheDocument();
    });
  });
});

describe("Editing a vacancy", () => {
  function serveEdit(onUpdate: (body: Sent) => void) {
    serveList();
    server.use(
      http.get(`${API}/vacancies/5`, () => HttpResponse.json(vacancyWithSkills)),
      http.put(`${API}/vacancies/5`, async ({ request }) => {
        onUpdate((await request.json()) as Sent);
        return HttpResponse.json(vacancyWithSkills);
      })
    );
  }

  it("loads the vacancy and saves the changes with each skill's id", async () => {
    let sent: Sent | undefined;
    serveEdit((body) => (sent = body));
    const { user } = renderApp("/vacancies/5/edit");

    const title = await screen.findByDisplayValue("Senior Frontend Engineer (TechCorp)");
    await user.clear(title);
    await user.type(title, "Staff Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    expect(await screen.findByRole("heading", { name: "Vacancies" })).toBeInTheDocument();
    expect(await screen.findByText("Senior Frontend Engineer (TechCorp)")).toBeInTheDocument();
    expect(sent?.vacancy.role_title).toBe("Staff Frontend Engineer");
    expect(sent?.vacancy.vacancy_skills_attributes).toEqual([
      expect.objectContaining({ id: 21, skill_label: "React", expected_level: 4 }),
      expect.objectContaining({ id: 22, skill_label: "Communication", expected_level: 3 }),
    ]);
  });

  describe("known defects", () => {
    // Same as the assessment form: a removed skill is left out instead of sent with `_destroy`, so it stays and
    // keeps counting in every fit/gap report against this vacancy.
    it.fails("P1-14: tells the API to delete a skill the assessor removed", async () => {
      let sent: Sent | undefined;
      serveEdit((body) => (sent = body));
      const { user } = renderApp("/vacancies/5/edit");

      await screen.findByDisplayValue("Senior Frontend Engineer (TechCorp)");
      const removeButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-x"));
      await user.click(removeButtons[1]);
      await user.click(screen.getByRole("button", { name: /Save/ }));
      await screen.findByRole("heading", { name: "Vacancies" });

      expect(sent?.vacancy.vacancy_skills_attributes).toContainEqual(expect.objectContaining({ id: 22, _destroy: true }));
    });
  });
});
