import { z } from "zod"

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address")

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 lowercase letters, numbers or underscores")

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
})

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required").max(80, "Name is too long"),
    username: usernameSchema,
    email: emailSchema,
    password: z.string().min(8, "Use at least 8 characters").max(72, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(80, "Name is too long"),
  username: usernameSchema,
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer").optional(),
})
