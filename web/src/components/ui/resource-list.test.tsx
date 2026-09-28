import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ResourceList from "./resource-list";

const meta = { current_page: 1, total_pages: 2, total_count: 3, per_page: 2 };
const records = [
  { id: 1, name: "Engineering", status: "Live" },
  { id: 2, name: "Design", status: "Pending" },
];
function setup(load: any) {
  render(
    <MemoryRouter>
      <ResourceList<{ id: number; name: string; status: string }>
        title="Assessments"
        singular="assessment"
        description="Interview assessments"
        createHref="/assessments/new"
        load={load}
        name={(r) => r.name}
        status={(r) => r.status}
        statuses={["Live", "Pending"]}
        columns={[{ label: "Name", render: (r) => r.name }]}
      />
    </MemoryRouter>,
  );
}
describe("Recruitment resource lists", () => {
  it("keeps load errors distinct from an empty collection and allows retry", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ records, meta });
    setup(load);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load");
    expect(screen.queryByText("No assessments yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Engineering")).toBeInTheDocument();
  });
  it("filters records, clears filters, and fetches the next API page", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ records, meta })
      .mockResolvedValue({
        records: [{ id: 3, name: "Operations", status: "Pending" }],
        meta: { ...meta, current_page: 2 },
      });
    setup(load);
    await screen.findByText("Engineering");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "design" },
    });
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.queryByText("Engineering")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filter by latest interview status on this page" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Live" }));
    expect(screen.queryByText("Design")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Operations")).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith(2);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
  it("shows a useful empty state and a creation link", async () => {
    setup(
      vi
        .fn()
        .mockResolvedValue({
          records: [],
          meta: { ...meta, total_count: 0, total_pages: 0 },
        }),
    );
    expect(await screen.findByText("No assessments yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /New assessment/ })[0],
    ).toHaveAttribute("href", "/assessments/new");
  });
});
