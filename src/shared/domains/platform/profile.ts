import { z } from "zod";

import { optionalString } from "@/shared/domains/pgr/form-fields";
import { cpfSchema } from "@/shared/domains/pgr/validation";
import type { User } from "@/shared/db/schema";

// CPF opcional no perfil: vazio → undefined; senão valida 11 dígitos (reusa cpfSchema).
const optionalCpf = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  cpfSchema.optional(),
);

// Edição de perfil cobre só os campos app-managed. Nome/e-mail/foto são de
// responsabilidade do Clerk (fonte da verdade) e exibidos read-only.
export const profileInputSchema = z.object({
  phone: optionalString,
  cpf: optionalCpf,
  jobTitle: optionalString,
});

export type ProfileInput = z.input<typeof profileInputSchema>;
export type ProfileValues = z.output<typeof profileInputSchema>;

export type ProfileView = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  phone: string | null;
  cpf: string | null;
  jobTitle: string | null;
};

export function toProfileView(user: User): ProfileView {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    phone: user.phone,
    cpf: user.cpf,
    jobTitle: user.jobTitle,
  };
}
