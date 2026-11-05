import { z } from "zod";
import { ROLES } from "./types.ts";

export const roleSchema = z.enum(ROLES);

export const askSchema = z.object({
  role: roleSchema,
  question: z.string().trim().min(1).max(400),
});

export const draftSchema = z.object({
  role: roleSchema,
});

export const decideSchema = z.object({
  role: roleSchema,
  courseId: z.string().trim().min(1).max(80),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(400).optional(),
});

export const taskSchema = z.object({
  role: roleSchema,
  taskId: z.string().trim().min(1).max(80),
  status: z.enum(["in-progress", "done"]),
});

export const observationSchema = z.object({
  role: roleSchema,
  note: z.string().trim().min(1).max(500),
});

export const trafficSchema = z.object({
  role: roleSchema,
  to: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(500),
});
