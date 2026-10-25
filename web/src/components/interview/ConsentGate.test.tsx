import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConsentGate from "./ConsentGate";

describe("ConsentGate", () => {
    it("disclose AI recording and third-party processing before any agreement", () => {
        render(<ConsentGate onAgree={() => { }} />)
        expect(screen.getByText(/recorded, transcribed, and/i)).toBeInTheDocument();
        expect(screen.getByText(/Google Gemini/i)).toBeInTheDocument();
    });

    it("calls onAgree when the candidate agrees to proceedd", () => {
        const onAgree = vi.fn();
        render(<ConsentGate onAgree={onAgree} />);
        const agreeButton = screen.getByRole("button", { name: /I understand and agree to proceed/i });
        fireEvent.click(agreeButton);
        expect(onAgree).toHaveBeenCalledTimes(1);
    })
});