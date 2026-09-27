import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PreFlightConsentModal from "@/components/interview/PreFlightConsentModal";

describe("PreFlightConsentModal (UU PDP No. 27/2022)", () => {
    it("renders UU PDP disclosure and keeps confirm button disabled until checkbox is checked", () => {
        const onConsent = vi.fn();
        const onDecline = vi.fn();

        render(
            <PreFlightConsentModal
                isOpen={true}
                onConsent={onConsent}
                onDecline={onDecline}
            />
        );

        // Disclosures present
        expect(screen.getAllByText(/UU PDP/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/biometrik|suara/i).length).toBeGreaterThan(0);

        // Button disabled initially
        const confirmBtn = screen.getByRole("button", { name: /Saya Menyetujui|Setuju/i });
        expect(confirmBtn).toBeDisabled();

        // Checkbox exists and can be toggled
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(confirmBtn).toBeEnabled();

        // Clicking confirm fires onConsent
        fireEvent.click(confirmBtn);
        expect(onConsent).toHaveBeenCalledTimes(1);
    });

    it("triggers onDecline when decline button is clicked", () => {
        const onConsent = vi.fn();
        const onDecline = vi.fn();

        render(
            <PreFlightConsentModal
                isOpen={true}
                onConsent={onConsent}
                onDecline={onDecline}
            />
        );

        const declineBtn = screen.getByRole("button", { name: /Tolak|Decline/i });
        fireEvent.click(declineBtn);
        expect(onDecline).toHaveBeenCalledTimes(1);
        expect(onConsent).not.toHaveBeenCalled();
    });
});
