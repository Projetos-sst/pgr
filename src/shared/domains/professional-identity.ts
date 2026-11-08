import { z } from "zod";
// Mensagens próprias em PT: sem elas, o texto padrão do Zod (em inglês) chegava à tela.
const text = (max: number, required: string) =>
  z
    .string({ error: required })
    .trim()
    .min(1, required)
    .max(max, `Máximo de ${max.toLocaleString("pt-BR")} caracteres.`);
export const professionalIdentitySchema = z
  .object({
    fullName: text(200, "Informe o nome completo do profissional."),
    profession: text(200, "Informe a profissão."),
    registration: z.discriminatedUnion(
      "kind",
      [
        z
          .object({
            kind: z.literal("registered"),
            council: text(100, "Informe o conselho ou órgão de registro."),
            number: text(100, "Informe o número do registro."),
            region: z
              .string({ error: "Região/UF do registro inválida." })
              .trim()
              .max(100, "Máximo de 100 caracteres.")
              .optional(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("not_applicable"),
            reason: text(
              1000,
              "Justifique por que o registro profissional não se aplica.",
            ),
          })
          .strict(),
      ],
      { error: "Informe se o registro profissional é aplicável." },
    ),
  })
  .strict();
export type ProfessionalIdentity = z.infer<typeof professionalIdentitySchema>;
