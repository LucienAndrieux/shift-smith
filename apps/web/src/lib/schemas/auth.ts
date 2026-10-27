import { z } from "zod";

export const PASSWORD_MIN = 10;

export const signInSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(100),
    email: z.email("Enter a valid email"),
    password: z
      .string()
      .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
      .max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
      .max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
