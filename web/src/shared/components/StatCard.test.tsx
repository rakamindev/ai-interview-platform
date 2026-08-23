import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ClipboardList } from "lucide-react";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard icon={ClipboardList} label="Total Assessments" value={12} />);
    expect(screen.getByText("Total Assessments")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders a string value as-is", () => {
    render(<StatCard icon={ClipboardList} label="Live Now" value="—" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
