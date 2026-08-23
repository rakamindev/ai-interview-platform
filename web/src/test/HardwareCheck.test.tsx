import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HardwareCheck from "@/components/HardwareCheck";

describe("HardwareCheck Component", () => {
  it("renders Indonesian UU PDP No. 27/2022 consent notice", () => {
    render(<HardwareCheck />);

    expect(
      screen.getByText(/Indonesian Personal Data Protection regulations \(UU PDP No. 27\/2022\)/i)
    ).toBeInTheDocument();
  });

  it("disables Start Interview button when checks are not all passed", () => {
    const onStart = vi.fn();
    render(<HardwareCheck onStart={onStart} />);

    const startBtn = screen.getByRole("button", { name: /Start Interview/i });
    expect(startBtn).toBeDisabled();

    fireEvent.click(startBtn);
    expect(onStart).not.toHaveBeenCalled();
  });
});
