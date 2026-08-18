import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .email("Invalid email address.")
    .min(1, { message: "Email is required." })
    .max(128, { message: "Maximum 128 characters allowed." }),
  password: z
    .string()
    .min(1, { message: "Password is required." })
    .max(128, { message: "Maximum 128 characters allowed." }),
});