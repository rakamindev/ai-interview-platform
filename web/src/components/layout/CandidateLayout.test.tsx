import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "@/test/utils";
import CandidateLayout from "./CandidateLayout";

describe("CandidateLayout", () => {
  it("renders the minimal header and the routed outlet", () => {
    renderWithProviders(
      <Routes>
        <Route element={<CandidateLayout />}>
          <Route path="/" element={<div>Interview content</div>} />
        </Route>
      </Routes>,
      { route: "/" },
    );
    expect(screen.getByText("AI Interview")).toBeInTheDocument();
    expect(screen.getByText("Interview content")).toBeInTheDocument();
  });
});
