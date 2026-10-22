import { z } from "zod";
import { requiredUuid } from "./form-fields";

const id = requiredUuid("Referência inválida.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
export const machineInstallationSchema = z
  .object({
    workUnitId: id,
    gesId: id.nullable(),
    catalogId: id,
    mode: z.enum(["individual", "group"]),
    quantity: z.number().int().min(1).max(100000),
    identifier: optionalText(200),
    description: z.string().trim().min(1).max(5000),
    operatingConditions: optionalText(5000),
    safetyMeasures: optionalText(5000),
    maintenanceNotes: optionalText(5000),
    responsible: optionalText(200),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.mode === "individual" && (data.quantity !== 1 || !data.identifier))
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "Máquina individual exige identificação e quantidade igual a 1.",
      });
  });
export const machineInstallationUpdateSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    data: machineInstallationSchema,
  })
  .strict();
export const machineInstallationArchiveSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type MachineInstallationInput = z.infer<typeof machineInstallationSchema>;
export type MachineInstallationFormValues = Omit<
  MachineInstallationInput,
  "reason" | "mode"
> & { id: string; mode: string; version: number; active: boolean };
