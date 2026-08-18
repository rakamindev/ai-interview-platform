import * as v from "valibot";

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty("Email is required"), v.email("Enter a valid email address")),
  password: v.pipe(
    v.string(),
    v.nonEmpty("Password is required"),
    v.minLength(6, "Password must be at least 6 characters")
  ),
});

export const userSchema = v.object({
  id: v.number(),
  email: v.string(),
  role: v.string(),
});

export const loginResponseSchema = v.object({
  token: v.string(),
  user: userSchema,
});

export const meResponseSchema = v.object({
  user: userSchema,
});

export type LoginValues = v.InferOutput<typeof loginSchema>;
export type LoginResponse = v.InferOutput<typeof loginResponseSchema>;
export type AuthUser = v.InferOutput<typeof userSchema>;
export type MeResponse = v.InferOutput<typeof meResponseSchema>;
