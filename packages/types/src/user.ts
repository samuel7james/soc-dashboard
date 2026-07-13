import { z } from "zod";

import { userRoleSchema } from "./enums.js";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(200),
  name: z.string().min(1).max(200),
  role: userRoleSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
