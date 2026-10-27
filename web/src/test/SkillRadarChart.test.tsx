import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillRadarChart from "../components/fitgap/SkillRadarChart";
import type { SkillComparison } from "@/types";

describe("SkillRadarChart (Interactive Visual Competency Map)", () => {
  it("renders horizontal comparative bars when fewer than 3 skills", () => {
    const twoSkills: SkillComparison[] = [
      { skill_label: "React", required_level: 4, candidate_level: 4, result: "match" },
      { skill_label: "Node.js", required_level: 3, candidate_level: 4, result: "exceed" },
    ];

    render(<SkillRadarChart comparisons={twoSkills} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText(/Comparative Competency Map/i)).toBeInTheDocument();
  });

  it("renders pure SVG Radar polygon chart when 3 or more skills", () => {
    const multiSkills: SkillComparison[] = [
      { skill_label: "PostgreSQL Architecture", required_level: 4, candidate_level: 3, result: "gap" },
      { skill_label: "Distributed Systems", required_level: 4, candidate_level: 5, result: "exceed" },
      { skill_label: "Ruby on Rails Core", required_level: 3, candidate_level: 3, result: "match" },
      { skill_label: "Redis Caching", required_level: 3, candidate_level: 4, result: "exceed" },
    ];

    const { container } = render(<SkillRadarChart comparisons={multiSkills} />);

    expect(screen.getByText(/Radar Kompetensi & Fit\/Gap Visual/i)).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("Benchmark")).toBeInTheDocument();

    // Check SVG polygon presence
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThanOrEqual(6); // 5 grid rings + required + candidate
  });
});
