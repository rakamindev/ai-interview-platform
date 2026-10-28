import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError, FormSection } from "@/components/ui/form-section";

describe("FormSection", () => {
    it("is a region named by its heading, with help text and fields", () => {
        render(
            <FormSection title="Expected skills" description="Choose the level a new hire needs.">
                <label htmlFor="judul">Role title</label>
                <input id="judul" />
            </FormSection>,
        );

        expect(screen.getByRole("region", { name: "Expected skills" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2, name: "Expected skills" })).toBeInTheDocument();
        expect(screen.getByText("Choose the level a new hire needs.")).toBeInTheDocument();
        expect(screen.getByLabelText("Role title")).toBeInTheDocument();
    });
});

describe("FieldError", () => {
    it("shows the message with an icon and keeps its id for aria-describedby", () => {
        render(<FieldError id="judul-error">Role title is required.</FieldError>);

        const error = screen.getByText("Role title is required.");
        expect(error.closest("p")).toHaveAttribute("id", "judul-error");
        expect(error.closest("p")?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("renders nothing without a message", () => {
        const { container } = render(<FieldError id="kosong" />);

        expect(container).toBeEmptyDOMElement();
    });
});
