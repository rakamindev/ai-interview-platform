import { describe, expect, it } from "vitest";

describe("test harness", () => {
    it("runs in a DOM environment", () => {
        document.body.innerHTML = "<p>ok</p>";
        expect(document.querySelector("p")).toHaveTextContent("ok");
    });
});
