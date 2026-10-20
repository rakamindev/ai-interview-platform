import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LevelBadge from "../LevelBadge";
import { parseLevel } from "@/utils/constants";

describe("parseLevel & LevelBadge (UI-03)", () => {
  describe("parseLevel", () => {
    it("returns null for null and undefined inputs", () => {
      expect(parseLevel(null)).toBeNull();
      expect(parseLevel(undefined)).toBeNull();
    });

    it("parses numbers and level strings accurately", () => {
      expect(parseLevel(3)).toBe(3);
      expect(parseLevel("L4")).toBe(4);
      expect(parseLevel("level 5")).toBe(5);
    });

    it("returns null for invalid or non-numeric strings", () => {
      expect(parseLevel("")).toBeNull();
      expect(parseLevel("N/A")).toBeNull();
    });
  });

  describe("LevelBadge component", () => {
    it("renders neutral 'Not Assessed' badge when level is null", () => {
      render(<LevelBadge level={null} size="md" />);

      const badge = screen.getByTestId("not-assessed-badge");
      expect(badge).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
      expect(screen.getByText("Not Assessed")).toBeInTheDocument();
      expect(screen.queryByText("L1")).not.toBeInTheDocument();
    });

    it("renders neutral badge in small size when level is undefined", () => {
      render(<LevelBadge level={undefined} size="sm" />);

      const badge = screen.getByTestId("not-assessed-badge");
      expect(badge).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders standard level badge when level is provided", () => {
      render(<LevelBadge level={3} size="md" />);

      expect(screen.getByText("L3")).toBeInTheDocument();
      expect(screen.getByText("Proficient")).toBeInTheDocument();
    });
  });
});
