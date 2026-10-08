import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  organization: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to play." }),
  }),
  displayMode: z.enum(["first_org", "full_name", "nickname"]),
  nickname: z.string().trim().max(20).optional(),
  // Honeypot: a real visitor never fills this hidden field in.
  website: z.string().max(0).optional().or(z.literal("")),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const startAttemptSchema = z.object({
  practice: z.boolean().optional().default(false),
});

export const submitAnswerSchema = z.object({
  position: z.number().int().min(0),
  questionId: z.string().min(1),
  chosenOption: z.number().int().min(0).max(3).nullable(),
  clientElapsedMs: z.number().finite().nullable().optional(),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const questionImportSchema = z.array(
  z.object({
    id: z.string().min(1),
    category: z.string().min(1),
    type: z.enum(["knowledge", "scenario"]),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prompt: z.string().min(1),
    options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    explanation: z.string().min(1),
    reference: z.string().optional().default(""),
    status: z.enum(["draft", "approved"]),
  })
);

export const questionStatusSchema = z.object({
  status: z.enum(["draft", "approved"]),
});
