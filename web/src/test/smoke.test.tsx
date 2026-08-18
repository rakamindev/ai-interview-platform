import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("harness smoke", () => {
    it("boots jsdom and renders a UI primitive", () => {
        render(<Button>Hello harness</Button>);
        expect(
            screen.getByRole("button", { name: /hello harness/i }),
        ).toBeInTheDocument();
    });
});
