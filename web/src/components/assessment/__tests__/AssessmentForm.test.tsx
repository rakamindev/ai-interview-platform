import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import AssessmentForm from "../AssessmentForm";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn().mockResolvedValue({ data: { skill_taxonomies: [] } }) },
}));

function renderForm(props: Partial<React.ComponentProps<typeof AssessmentForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <AssessmentForm mode="create" title="New Assessment" onSubmit={onSubmit} submitting={false} {...props} />
    </MemoryRouter>,
  );
  return onSubmit;
}

describe("AssessmentForm", () => {
  it("blocks submit and explains why when the role title is empty", async () => {
    const onSubmit = renderForm();

    await userEvent.click(screen.getByRole("button", { name: /create and invite candidates/i }));

    expect(await screen.findByText("Role title is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers the interview language only when creating", () => {
    renderForm();
    expect(screen.getByText("Interview language")).toBeInTheDocument();
  });

  it("adds and removes a custom skill card", async () => {
    renderForm();
    expect(screen.getByText("No skills added yet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add custom skill/i }));

    expect(screen.queryByText("No skills added yet")).not.toBeInTheDocument();
    expect(screen.getByText("1 skill")).toBeInTheDocument();
  });

  it("surfaces a submit error from the page", () => {
    renderForm({ error: "Failed to save assessment." });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save assessment.");
  });
});
