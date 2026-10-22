import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const professionalIdentitySchema = z
  .object({
    fullName: text(200),
    profession: text(200),
    registration: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("registered"),
          council: text(100),
          number: text(100),
          region: z.string().trim().max(100).optional(),
        })
        .strict(),
      z.object({ kind: z.literal("not_applicable"), reason: text(1000) }).strict(),
    ]),
  })
  .strict();
export type ProfessionalIdentity = z.infer<typeof professionalIdentitySchema>;
