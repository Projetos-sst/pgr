import { z } from "zod";

import type { Medico } from "@/shared/db/schema/medicos";

import { optionalString, requiredString } from "./form-fields";

export type { Medico };

export const MEDICO_STATUSES = ["active", "inactive"] as const;

export const medicoStatusSchema = z.enum(MEDICO_STATUSES, {
  error: "Status inválido",
});

export type MedicoStatus = (typeof MEDICO_STATUSES)[number];

/** Rótulos pt-BR do status (enum em inglês no banco → UI em pt-BR). */
export const MEDICO_STATUS_LABELS: Record<MedicoStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
};

export const medicoInputSchema = z.object({
  name: requiredString("Nome é obrigatório"),
  crm: requiredString("CRM é obrigatório"),
  specialty: optionalString,
  clinic: optionalString,
  phone: optionalString,
  status: medicoStatusSchema.default("active"),
});

export type MedicoInput = z.input<typeof medicoInputSchema>;
export type MedicoValues = z.output<typeof medicoInputSchema>;

/** DTO de listagem: `MedicoListItem = Medico` (rótulo de status formatado na UI). */
export type MedicoListItem = Medico;

/** Opção (id + nome) para selects (ex.: médico responsável em exames/ASO). */
export type MedicoOption = Pick<Medico, "id" | "name" | "crm">;
