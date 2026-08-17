import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CompareCandidatePicker from "@/components/portfolio/CompareCandidatePicker";
import { candidatesApi } from "@/services/candidates";
import type { Candidate } from "@/types";

vi.mock("@/services/candidates", () => ({
  candidatesApi: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(candidatesApi.list);

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 1,
    candidate_name: "Alice",
    session_id: 1,
    session_status: "ended",
    interview_status: "completed",
    verdict: "pass",
    ...overrides,
  };
}

function mockList(candidates: Candidate[]) {
  listMock.mockResolvedValue({
    data: { candidates, meta: { current_page: 1, total_pages: 1, total_count: candidates.length, per_page: 10 } },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CompareCandidatePicker", () => {
  it("lists other completed candidates and calls onSelect when one is picked", async () => {
    mockList([candidate({ candidate_id: 2, candidate_name: "Bob", session_id: 2 })]);
    const onSelect = vi.fn();

    render(<CompareCandidatePicker assessmentId={1} excludeSessionId={9} onSelect={onSelect} />);

    fireEvent.click(await screen.findByText("Bob"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ candidate_id: 2, candidate_name: "Bob" }));
  });

  it("excludes the current session from the list even if the API returns it", async () => {
    mockList([
      candidate({ candidate_id: 9, candidate_name: "Self", session_id: 9 }),
      candidate({ candidate_id: 2, candidate_name: "Bob", session_id: 2 }),
    ]);

    render(<CompareCandidatePicker assessmentId={1} excludeSessionId={9} onSelect={vi.fn()} />);

    await screen.findByText("Bob");
    expect(screen.queryByText("Self")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no other completed candidates", async () => {
    mockList([]);

    render(<CompareCandidatePicker assessmentId={1} excludeSessionId={9} onSelect={vi.fn()} />);

    expect(await screen.findByText("No other completed candidates yet to compare with.")).toBeInTheDocument();
  });

  it("shows an error state when the candidate list fails to load", async () => {
    listMock.mockRejectedValue(new Error("network down"));

    render(<CompareCandidatePicker assessmentId={1} excludeSessionId={9} onSelect={vi.fn()} />);

    expect(await screen.findByText("Couldn't load candidates.")).toBeInTheDocument();
  });

  it("passes the search term through to the API after debouncing", async () => {
    mockList([candidate({ candidate_id: 2, candidate_name: "Bob", session_id: 2 })]);

    render(<CompareCandidatePicker assessmentId={1} excludeSessionId={9} onSelect={vi.fn()} />);
    await screen.findByText("Bob");

    fireEvent.change(screen.getByPlaceholderText("Search candidate name..."), { target: { value: "bob" } });

    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ interview_status: "completed", search: "bob" })
      )
    );
  });
});
