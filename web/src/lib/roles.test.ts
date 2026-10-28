import { describe, expect, it } from "vitest";
import { homePathForRole, isAssessorRole } from "@/lib/roles";

describe("isAssessorRole", () => {
    it("accepts only the admin superuser", () => {
        expect(isAssessorRole("admin")).toBe(true);
        expect(isAssessorRole("user")).toBe(false);
        expect(isAssessorRole(null)).toBe(false);
        expect(isAssessorRole(undefined)).toBe(false);
    });
});

describe("homePathForRole", () => {
    it("sends assessors to the assessor workspace", () => {
        expect(homePathForRole("admin")).toBe("/assessments");
    });

    it("sends candidates — and unknown roles — to the candidate home", () => {
        expect(homePathForRole("user")).toBe("/candidate");
        expect(homePathForRole(null)).toBe("/candidate");
        expect(homePathForRole(undefined)).toBe("/candidate");
    });
});
