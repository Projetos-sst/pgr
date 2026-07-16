import { z } from "zod";

import type { EsocialEventType } from "@/shared/db/schema";

import { buildEnvelope, buildEventId, tag } from "./xml";

const cpf = z
  .string()
  .trim()
  .regex(/^\d{11}$/, { message: "CPF deve ter 11 dígitos" });
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" });
const nonEmpty = z.string().trim().min(1);

// ── S-2190 · Registro Preliminar de Admissão ────────────────────────────────
export const s2190Schema = z.object({
  cpf,
  dataAdmissao: dateStr,
  matricula: z.string().trim().optional(),
});
function buildS2190(i: z.infer<typeof s2190Schema>): string {
  const inner =
    `<ideVinculo>${tag("cpfTrab", i.cpf)}${tag("matricula", i.matricula)}</ideVinculo>` +
    `<infoRegPrelim>${tag("dtAdm", i.dataAdmissao)}</infoRegPrelim>`;
  return buildEnvelope("evtAdmPrelim", buildEventId(i.cpf), inner);
}

// ── S-2200 · Cadastramento Inicial / Admissão ───────────────────────────────
export const s2200Schema = z.object({
  cpf,
  nome: nonEmpty,
  dataNascimento: dateStr,
  dataAdmissao: dateStr,
  matricula: z.string().trim().optional(),
});
function buildS2200(i: z.infer<typeof s2200Schema>): string {
  const inner =
    `<trabalhador>${tag("cpfTrab", i.cpf)}${tag("nmTrab", i.nome)}` +
    `${tag("dtNascto", i.dataNascimento)}</trabalhador>` +
    `<vinculo>${tag("matricula", i.matricula)}` +
    `<infoContrato>${tag("dtAdm", i.dataAdmissao)}</infoContrato></vinculo>`;
  return buildEnvelope("evtAdmissao", buildEventId(i.cpf), inner);
}

// ── S-2210 · Comunicação de Acidente de Trabalho (CAT) ──────────────────────
export const s2210Schema = z.object({
  cpf,
  dataAcidente: dateStr,
  tipoAcidente: z.string().trim().default("1"),
  descricao: nonEmpty,
});
function buildS2210(i: z.infer<typeof s2210Schema>): string {
  const inner =
    `<ideVinculo>${tag("cpfTrab", i.cpf)}</ideVinculo>` +
    `<cat>${tag("dtAcid", i.dataAcidente)}${tag("tpAcid", i.tipoAcidente)}` +
    `${tag("dsLesao", i.descricao)}</cat>`;
  return buildEnvelope("evtCAT", buildEventId(i.cpf), inner);
}

// ── S-2220 · Monitoramento da Saúde do Trabalhador (ASO) ────────────────────
export const s2220Schema = z.object({
  cpf,
  dataAso: dateStr,
  tipoExame: z.string().trim().default("0"),
  resultado: z.string().trim().optional(),
});
function buildS2220(i: z.infer<typeof s2220Schema>): string {
  const inner =
    `<ideVinculo>${tag("cpfTrab", i.cpf)}</ideVinculo>` +
    `<exMedOcup>${tag("tpExameOcup", i.tipoExame)}` +
    `<aso>${tag("dtAso", i.dataAso)}${tag("resAso", i.resultado)}</aso></exMedOcup>`;
  return buildEnvelope("evtMonit", buildEventId(i.cpf), inner);
}

// ── S-2221 · Exame Toxicológico do Motorista ────────────────────────────────
export const s2221Schema = z.object({
  cpf,
  dataExame: dateStr,
  cnpjLaboratorio: z
    .string()
    .trim()
    .regex(/^\d{14}$/, { message: "CNPJ deve ter 14 dígitos" }),
  codExame: nonEmpty,
});
function buildS2221(i: z.infer<typeof s2221Schema>): string {
  const inner =
    `<ideVinculo>${tag("cpfTrab", i.cpf)}</ideVinculo>` +
    `<toxicologico>${tag("dtExm", i.dataExame)}${tag("cnpjLab", i.cnpjLaboratorio)}` +
    `${tag("codExame", i.codExame)}</toxicologico>`;
  return buildEnvelope("evtToxic", buildEventId(i.cpf), inner);
}

// ── S-2240 · Condições Ambientais do Trabalho (Agentes Nocivos) ─────────────
export const s2240Schema = z.object({
  cpf,
  dataInicio: dateStr,
  codigoAgenteNocivo: nonEmpty,
  unidadeMedida: z.string().trim().optional(),
  descricaoAtividade: z.string().trim().optional(),
});
function buildS2240(i: z.infer<typeof s2240Schema>): string {
  const inner =
    `<ideVinculo>${tag("cpfTrab", i.cpf)}</ideVinculo>` +
    `<infoExpRisco>${tag("dtIniCondicao", i.dataInicio)}` +
    `${tag("dscAtivDes", i.descricaoAtividade)}` +
    `<agNoc>${tag("codAgNoc", i.codigoAgenteNocivo)}${tag("unMed", i.unidadeMedida)}</agNoc>` +
    `</infoExpRisco>`;
  return buildEnvelope("evtExpRisco", buildEventId(i.cpf), inner);
}

// ── S-2300 · Trabalhador Sem Vínculo de Emprego — Início ────────────────────
export const s2300Schema = z.object({
  cpf,
  nome: nonEmpty,
  dataNascimento: dateStr,
  categoria: z.string().trim().default("901"),
});
function buildS2300(i: z.infer<typeof s2300Schema>): string {
  const inner =
    `<trabalhador>${tag("cpfTrab", i.cpf)}${tag("nmTrab", i.nome)}` +
    `${tag("dtNascto", i.dataNascimento)}</trabalhador>` +
    `<infoTSVInicio>${tag("categoria", i.categoria)}</infoTSVInicio>`;
  return buildEnvelope("evtTSVInicio", buildEventId(i.cpf), inner);
}

type BuilderEntry = {
  schema: z.ZodTypeAny;
  build: (input: unknown) => string;
};

// Registry: tipo de evento → { schema, build }. Cada build valida e retorna XML.
export const esocialBuilders: Record<EsocialEventType, BuilderEntry> = {
  "S-2190": { schema: s2190Schema, build: (i) => buildS2190(s2190Schema.parse(i)) },
  "S-2200": { schema: s2200Schema, build: (i) => buildS2200(s2200Schema.parse(i)) },
  "S-2210": { schema: s2210Schema, build: (i) => buildS2210(s2210Schema.parse(i)) },
  "S-2220": { schema: s2220Schema, build: (i) => buildS2220(s2220Schema.parse(i)) },
  "S-2221": { schema: s2221Schema, build: (i) => buildS2221(s2221Schema.parse(i)) },
  "S-2240": { schema: s2240Schema, build: (i) => buildS2240(s2240Schema.parse(i)) },
  "S-2300": { schema: s2300Schema, build: (i) => buildS2300(s2300Schema.parse(i)) },
};

// Monta o XML do evento validando o input pelo schema do tipo.
export function buildEsocialXml(type: EsocialEventType, input: unknown): string {
  return esocialBuilders[type].build(input);
}
