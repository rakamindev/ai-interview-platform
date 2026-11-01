import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { create: vi.fn(), get: vi.fn(), update: vi.fn() },
}));

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn().mockResolvedValue({ data: { skill_taxonomies: [] } }) },
}));

function notFound() {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Not found", "ERR_BAD_REQUEST", config, null, {
    status: 404,
    statusText: "",
    headers: {},
    config,
    data: { errors: [{ message: "Assessment not found" }] },
  });
}

const savedAssessment: Assessment = {
  id: 7,
  name: "Frontend Engineer",
  time_limit_min: 45,
  language: "id",
  skills: [
    {
      id: 11,
      skill_label: "React",
      is_custom: false,
      expected_level: 3,
      display_order: 0,
      l1_anchor: "a",
      l2_anchor: "b",
      l3_anchor: "c",
      l4_anchor: "d",
      l5_anchor: "e",
    },
    {
      id: 12,
      skill_label: "Testing",
      is_custom: false,
      expected_level: 4,
      display_order: 1,
      l1_anchor: "a",
      l2_anchor: "b",
      l3_anchor: "c",
      l4_anchor: "d",
      l5_anchor: "e",
    },
  ],
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/assessments", element: <p>Assessment list</p> },
      { path: "/assessments/new", element: <AssessmentNewPage /> },
      { path: "/assessments/:id/edit", element: <AssessmentEditPage /> },
      { path: "/assessments/:id/invite", element: <p>Invite page</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("AssessmentNewPage validation", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.create).mockReset();
  });

  it("rejects a whitespace-only role title with a visible message", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "   ");
    await user.click(screen.getByRole("button", { name: /Save & Create Session/ }));

    expect(await screen.findByText("Role title is required")).toBeInTheDocument();
    expect(assessmentsApi.create).not.toHaveBeenCalled();
  });

  it("limits text fields to what the database column can store", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.click(screen.getByRole("button", { name: /Add custom skill/ }));

    expect(screen.getByLabelText(/Role title/)).toHaveAttribute("maxlength", "255");
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("maxlength", "255");
  });

  it("explains which custom skill fields are missing", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /Add custom skill/ }));
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    expect(await screen.findByText("Skill name is required")).toBeInTheDocument();
    expect(screen.getByText("Describe what counts")).toBeInTheDocument();
    expect(screen.getByText("Describe what L1 looks like")).toBeInTheDocument();
    expect(screen.getByText("Describe what L5 looks like")).toBeInTheDocument();
    expect(assessmentsApi.create).not.toHaveBeenCalled();
  });

  it("adds a custom skill only after its modal form is saved", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.click(screen.getByRole("button", { name: /Add custom skill/ }));
    expect(screen.getByRole("dialog", { name: "Add custom skill" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("No skills added yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add custom skill/ }));
    await user.type(screen.getByLabelText(/^Name/), "Communication");
    await user.type(screen.getByLabelText(/What counts/), "Explains decisions clearly");
    for (let level = 1; level <= 5; level += 1) {
      await user.type(screen.getByLabelText(`L${level} anchor *`), `Level ${level} behavior`);
    }
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    expect(screen.queryByRole("dialog", { name: "Add custom skill" })).not.toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Explains decisions clearly")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });
});

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockReset();
    vi.mocked(assessmentsApi.update).mockReset();
  });

  it("shows an error instead of an empty form when loading fails", async () => {
    vi.mocked(assessmentsApi.get).mockRejectedValue(notFound());
    renderAt("/assessments/7/edit");

    expect(
      await screen.findByText("This assessment doesn't exist or was deleted."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("deletes a removed skill and keeps the others and the language on save", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: savedAssessment },
    } as Awaited<ReturnType<typeof assessmentsApi.get>>);
    vi.mocked(assessmentsApi.update).mockResolvedValue(
      {} as Awaited<ReturnType<typeof assessmentsApi.update>>,
    );
    const user = userEvent.setup();
    renderAt("/assessments/7/edit");

    await screen.findByDisplayValue("Frontend Engineer");
    await user.click(screen.getAllByRole("button", { name: "Remove skill" })[0]);
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(assessmentsApi.update).toHaveBeenCalled());
    const [, payload] = vi.mocked(assessmentsApi.update).mock.calls[0];
    expect(payload.language).toBe("id");
    expect(payload.assessment_skills_attributes).toEqual([
      expect.objectContaining({ id: 12, skill_label: "Testing", display_order: 0 }),
      { id: 11, _destroy: true },
    ]);
  });
});

describe("Unsaved changes", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockReset();
    vi.mocked(assessmentsApi.update).mockReset();
  });

  it("asks before leaving a form with unsaved changes", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.type(screen.getByLabelText(/Role title/), "Frontend Engineer");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByDisplayValue("Frontend Engineer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(await screen.findByText("Assessment list")).toBeInTheDocument();
  });

  it("leaves an untouched form without asking", async () => {
    const user = userEvent.setup();
    renderAt("/assessments/new");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Assessment list")).toBeInTheDocument();
  });

  it("counts a level change as an unsaved change", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: savedAssessment },
    } as Awaited<ReturnType<typeof assessmentsApi.get>>);
    const user = userEvent.setup();
    renderAt("/assessments/7/edit");

    await screen.findByDisplayValue("Frontend Engineer");
    await user.click(screen.getAllByText("L5")[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
  });

  it("does not ask after a successful save", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: savedAssessment },
    } as Awaited<ReturnType<typeof assessmentsApi.get>>);
    vi.mocked(assessmentsApi.update).mockResolvedValue(
      {} as Awaited<ReturnType<typeof assessmentsApi.update>>,
    );
    const user = userEvent.setup();
    renderAt("/assessments/7/edit");

    const title = await screen.findByDisplayValue("Frontend Engineer");
    await user.type(title, " II");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Invite page")).toBeInTheDocument();
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  });
});
