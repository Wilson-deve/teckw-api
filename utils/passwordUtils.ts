import { z } from "zod";
import bcrypt from "bcryptjs";

// Password schema for consistent validation
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

// Verify password meets requirements
export const validatePassword = (password: string) => {
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((err) => err.message),
    };
  }
  return { valid: true, errors: [] };
};

// Hash password with bcrypt
export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};
