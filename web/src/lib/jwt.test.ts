import { describe, expect, it } from "vitest";
import { decodeJwtPayload, roleFromToken } from "@/lib/jwt";

function fakeToken(payload: object): string {
    const encode = (value: object) =>
        btoa(JSON.stringify(value))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("decodeJwtPayload", () => {
    it("decodes the payload segment", () => {
        expect(decodeJwtPayload(fakeToken({ user_id: 7, role: "admin" }))).toEqual({
            user_id: 7,
            role: "admin",
        });
    });

    it("returns null when there is no payload segment", () => {
        expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    });

    it("returns null for an undecodable payload", () => {
        expect(decodeJwtPayload("header.%%%.signature")).toBeNull();
    });
});

describe("roleFromToken", () => {
    it("returns the role claim", () => {
        expect(roleFromToken(fakeToken({ role: "user" }))).toBe("user");
        expect(roleFromToken(fakeToken({ role: "admin" }))).toBe("admin");
    });

    it("returns null when the claim is missing, not a string, or the token is absent", () => {
        expect(roleFromToken(fakeToken({ user_id: 1 }))).toBeNull();
        expect(roleFromToken(fakeToken({ role: 42 }))).toBeNull();
        expect(roleFromToken(null)).toBeNull();
        expect(roleFromToken(undefined)).toBeNull();
    });
});
