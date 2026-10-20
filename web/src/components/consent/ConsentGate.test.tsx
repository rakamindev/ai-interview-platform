import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConsentGate from "@/components/consent/ConsentGate";
import { PRIVACY_NOTICE } from "@/content/privacyNotice";
import type { ConsentState } from "@/types";

const PENDING: ConsentState = {
    required: true,
    accepted: false,
    declined: false,
    version: "v1",
};

const DECLINED: ConsentState = { ...PENDING, declined: true };

function renderGate(overrides: Partial<React.ComponentProps<typeof ConsentGate>> = {}) {
    const onAccept = vi.fn();
    const onDecline = vi.fn();

    render(
        <ConsentGate
            roleTitle="Backend Engineer"
            timeLimitMin={45}
            consent={PENDING}
            busy={false}
            onAccept={onAccept}
            onDecline={onDecline}
            {...overrides}
        />
    );

    return { onAccept, onDecline };
}

describe("ConsentGate", () => {
    it("states what is collected, who processes it, and the rights the candidate has", () => {
        renderGate();

        const headings = PRIVACY_NOTICE.map((section) => section.heading);
        for (const heading of headings) {
            expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
        }

        expect(screen.getByText(/Google Gemini is used as a subprocessor/)).toBeInTheDocument();
        expect(screen.getByText(/Withdraw this consent at any time/)).toBeInTheDocument();
        expect(screen.getByText(/no decision is made by the system alone/)).toBeInTheDocument();
    });

    it("requires a decision before the interview and reports the role and duration", () => {
        renderGate();

        expect(screen.getByText(/Backend Engineer · 45 minutes/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "I agree and continue" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "I do not agree" })).toBeEnabled();
    });

    it("reports both decisions to the caller", () => {
        const { onAccept, onDecline } = renderGate();

        fireEvent.click(screen.getByRole("button", { name: "I agree and continue" }));
        expect(onAccept).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "I do not agree" }));
        expect(onDecline).toHaveBeenCalledTimes(1);
    });

    it("disables both actions while a decision is being recorded", () => {
        renderGate({ busy: true });

        expect(screen.getByRole("button", { name: /I agree and continue/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: "I do not agree" })).toBeDisabled();
    });

    it("surfaces a retryable failure without letting the candidate through", () => {
        renderGate({ errorMessage: "We could not record your consent. Check your connection and try again." });

        expect(screen.getByRole("alert")).toHaveTextContent("We could not record your consent");
        expect(screen.getByRole("button", { name: "I agree and continue" })).toBeEnabled();
    });

    it("blocks a declined candidate and explains how to withdraw data", () => {
        renderGate({ consent: DECLINED });

        expect(screen.getByRole("heading", { name: "You cannot continue without consent." })).toBeInTheDocument();
        expect(
            screen.getByText("To withdraw your consent or ask questions about your data, contact the hiring team with your invite link.")
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "I agree and continue" })).not.toBeInTheDocument();
    });
});
