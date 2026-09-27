import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormErrorAlert } from "./form-error-alert";

describe("FormErrorAlert", () => {
    it("announces the message as an alert", () => {
        render(<FormErrorAlert message="Skill 'RESTful API Design' is listed more than once" onDismiss={vi.fn()} />);

        expect(screen.getByRole("alert")).toHaveTextContent("Skill 'RESTful API Design' is listed more than once");
    });

    it("can be dismissed", async () => {
        const onDismiss = vi.fn();
        render(<FormErrorAlert message="Something went wrong" onDismiss={onDismiss} />);

        await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("renders nothing without a message", () => {
        render(<FormErrorAlert message={null} onDismiss={vi.fn()} />);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
