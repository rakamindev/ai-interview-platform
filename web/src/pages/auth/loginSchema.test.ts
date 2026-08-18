import { describe, expect, it } from "vitest";
import { loginSchema } from "@/pages/auth/loginSchema";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Invalid email address."
      );
    }
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email address.");
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Password is required.");
    }
  });

  it("rejects email longer than 128 characters", () => {
    const result = loginSchema.safeParse({
      email: `${"a".repeat(120)}@test.com`,
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "a".repeat(129),
    });

    expect(result.success).toBe(false);
  });
});