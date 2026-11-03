/**
 * Prontuário segregado do exame (NOB-155, DT-21, MED-10/17). Regras puras: validação das entradas
 * e a guarda contra diagnóstico/CID na comunicação ao RH. O sistema não gera conteúdo clínico:
 * todo texto é escrito pelo médico (DT-23).
 */
import { z } from "zod";

export const CLINICAL_NOTE_MAX = 5000;
export const WORK_RESTRICTION_MAX = 1000;

export const CLINICAL_NOTES_MOVED_MESSAGE =
  "Observações clínicas não ficam mais no cadastro do exame: o médico examinador ou o coordenador vinculado as registra no prontuário.";

export const DIAGNOSIS_IN_RESTRICTION_MESSAGE =
  "A comunicação ao RH descreve só a restrição funcional ao trabalho, sem diagnóstico nem CID.";

/**
 * Código CID-10 (ex.: M54, M54.5, F32.1) ou a palavra "CID" no texto. Guarda conservadora para a
 * comunicação ao RH, que nunca pode carregar diagnóstico. Não substitui o cuidado do médico.
 */
export function containsDiagnosisCode(text: string): boolean {
  return /\bCID\b/i.test(text) || /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/i.test(text);
}

export const clinicalNoteInputSchema = z
  .object({
    content: z
      .string({ error: "Escreva a observação clínica." })
      .trim()
      .min(1, "Escreva a observação clínica.")
      .max(
        CLINICAL_NOTE_MAX,
        `Observação clínica: máximo de ${CLINICAL_NOTE_MAX.toLocaleString("pt-BR")} caracteres.`,
      ),
  })
  .strict();

export type ClinicalNoteValues = z.output<typeof clinicalNoteInputSchema>;

export const workRestrictionInputSchema = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        kind: z.literal("restriction"),
        restriction: z
          .string({ error: "Descreva a restrição ao trabalho." })
          .trim()
          .min(1, "Descreva a restrição ao trabalho.")
          .max(
            WORK_RESTRICTION_MAX,
            `Restrição: máximo de ${WORK_RESTRICTION_MAX.toLocaleString("pt-BR")} caracteres.`,
          )
          .refine((value) => !containsDiagnosisCode(value), {
            message: DIAGNOSIS_IN_RESTRICTION_MESSAGE,
          }),
      })
      .strict(),
    z.object({ kind: z.literal("withdrawal") }).strict(),
  ],
  { error: "Informe se registra uma restrição ou a retirada das restrições." },
);

export type WorkRestrictionValues = z.output<typeof workRestrictionInputSchema>;

export type ClinicalAccessBasis = "examiner" | "coordinator";

export const CLINICAL_ACCESS_BASIS_LABELS: Record<ClinicalAccessBasis, string> = {
  examiner: "Médico examinador",
  coordinator: "Coordenador do PCMSO",
};

export const CLINICAL_NOTE_ORIGIN_LABELS = {
  clinician: "Registrada pelo médico",
  legacy_exam_notes: "Migrada das antigas observações do exame (autoria não registrada)",
} as const;

export const CLINICAL_ACCESS_ACTION_LABELS = {
  read: "Leitura do prontuário",
  note_added: "Observação clínica registrada",
  restriction_recorded: "Comunicação de restrição registrada",
} as const;

export type ClinicalNoteView = {
  id: string;
  origin: keyof typeof CLINICAL_NOTE_ORIGIN_LABELS;
  content: string;
  authorName: string | null;
  authorRegistration: string | null;
  recordedAt: string;
};

export type ClinicalRecordView = {
  basis: ClinicalAccessBasis;
  notes: ClinicalNoteView[];
};

/** Comunicação ao RH: só a restrição funcional, a autoria e a data. */
export type WorkRestrictionView = {
  id: string;
  kind: "restriction" | "withdrawal";
  restriction: string | null;
  authorName: string | null;
  recordedAt: string;
};

export type ClinicalAccessEventView = {
  id: string;
  action: keyof typeof CLINICAL_ACCESS_ACTION_LABELS;
  basis: ClinicalAccessBasis;
  medicoName: string | null;
  occurredAt: string;
};
