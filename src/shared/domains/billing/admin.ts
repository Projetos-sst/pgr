import { z } from "zod";
import { billingStatusSchema } from "./contracts";
export const billingAdminFilterSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    search: z.string().trim().max(120).optional(),
    companyId: z.guid().optional(),
    plan: z.string().trim().max(80).optional(),
    product: z.enum(["pro", "pgr", "medicine"]).optional(),
    status: billingStatusSchema.optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .strict()
  .refine((x) => !x.from || !x.to || x.from <= x.to, { message: "Período inválido" });
export type BillingAdminFilter = z.infer<typeof billingAdminFilterSchema>;
