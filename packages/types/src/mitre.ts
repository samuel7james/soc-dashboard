import { z } from "zod";

export const mitreTechniqueSchema = z.object({
  id: z.string(),
  name: z.string(),
  tactic: z.string(),
  description: z.string().nullable(),
  url: z.string().nullable(),
});
export type MitreTechnique = z.infer<typeof mitreTechniqueSchema>;
