import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { healthExams } from "./health-exams";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Prévias arquivadas do ASO (NOB-152). Cada versão é um arquivo imutável: conteúdo JSON com hash
 * SHA-256, montado só com os dados do exame realmente cadastrados (NR-7 7.5.19.1). Só existe o
 * status `preview`: emitir o ASO exige a assinatura do médico examinador por mecanismo
 * verificável (MED-12), que ainda não existe — o CHECK impede gravar outro status. Sem UPDATE nem
 * DELETE para o `app_runtime`; a FK para o exame não cascateia, então o histórico não some junto
 * com o exame ou o funcionário.
 */
export const asoDocuments = pgTable(
  "aso_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("preview"),
    content: jsonb("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_aso_documents_version").on(t.orgId, t.healthExamId, t.version),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.healthExamId, t.orgId, t.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }),
    index("idx_aso_documents_exam").on(t.orgId, t.healthExamId, t.version),
    check("ck_aso_documents_status", sql`${t.status} = 'preview'`),
    check("ck_aso_documents_version", sql`${t.version} > 0`),
    check("ck_aso_documents_hash", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    pgPolicy("aso_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("aso_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // A prévia só nasce de exame com médico examinador, com o ator como autor.
    pgPolicy("aso_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.generatedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h where h.id = ${t.healthExamId} and h.org_id = ${t.orgId} and h.company_id = ${t.companyId} and h.doctor_id is not null)`,
    }),
  ],
).enableRLS();

export type AsoDocument = InferSelectModel<typeof asoDocuments>;

/**
 * Confirmação de apto/inapto pelo médico examinador (NOB-152, MED-01, MED-10). Exigida quando o
 * exame registra "apto com restrição": a NR-7 7.5.19.1 e pede apto ou inapto e o sistema não
 * converte a conclusão. Só a conta vinculada (NOB-149) ao médico examinador do exame confirma, e só
 * enquanto o registro do exame continua "apto com restrição". O registro original não é alterado.
 * Só inclusão: a confirmação vigente é a mais recente que ainda corresponde ao exame.
 */
export const asoExaminerConclusions = pgTable(
  "aso_examiner_conclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    conclusion: text("conclusion").$type<"fit" | "unfit">().notNull(),
    recordedAptitude: text("recorded_aptitude").notNull(),
    // Proveniência: sem FK, para a confirmação sobreviver a mudanças no cadastro do médico.
    examinerMedicoId: uuid("examiner_medico_id").notNull(),
    confirmedBy: text("confirmed_by").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.healthExamId, t.orgId, t.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }),
    index("idx_aso_examiner_conclusions_exam").on(t.orgId, t.healthExamId, t.confirmedAt),
    check("ck_aso_examiner_conclusions_value", sql`${t.conclusion} in ('fit','unfit')`),
    check(
      "ck_aso_examiner_conclusions_recorded",
      sql`${t.recordedAptitude} = 'fit_with_restrictions'`,
    ),
    pgPolicy("aso_examiner_conclusions_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("aso_examiner_conclusions_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Só a conta vinculada ao médico examinador do exame, enquanto o exame registra
    // "apto com restrição"; o papel no escritório não substitui o vínculo.
    pgPolicy("aso_examiner_conclusions_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      // NOB-158: examinador com identidade verificada (função central).
      withCheck: sql`${t.confirmedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        where h.id = ${t.healthExamId} and h.org_id = ${t.orgId} and h.company_id = ${t.companyId}
          and h.doctor_id = ${t.examinerMedicoId} and h.aptitude::text = ${t.recordedAptitude}
          and h.doctor_id in (select public.actor_clinical_medico_ids(h.org_id)))`,
    }),
  ],
).enableRLS();

export type AsoExaminerConclusion = InferSelectModel<typeof asoExaminerConclusions>;

/** Método de assinatura do ASO arquivado (MED-12). O sistema não assina: registra como foi assinado. */
export type AsoSignatureMethod = "icp_brasil" | "electronic" | "handwritten";
/** Fluxo A (examinador do exame, a partir da prévia) ou fluxo B (clínica externa) (MED-01). */
export type AsoSignedOrigin = "examiner" | "external_clinic";

/**
 * ASO assinado arquivado (NOB-163; MED-01, MED-11, MED-12; NR-7 7.5.19.1 "g"). É o ASO oficial:
 * o PDF assinado pelo médico examinador, guardado com SHA-256 calculado no servidor e no bucket
 * privado do tenant. O sistema não assina e não presume assinatura: a conferência é obrigatória
 * (referência do validador para ICP-Brasil/plataforma; guarda do original físico para assinatura
 * manual). Correção = nova linha que substitui a anterior, com motivo; nada é alterado ou apagado.
 */
export const asoSignedDocuments = pgTable(
  "aso_signed_documents",
  {
    id: uuid("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    origin: text("origin").$type<AsoSignedOrigin>().notNull(),
    previewDocumentId: uuid("preview_document_id"),
    signatureMethod: text("signature_method").$type<AsoSignatureMethod>().notNull(),
    verificationReference: text("verification_reference").notNull(),
    signerName: text("signer_name").notNull(),
    signerRegistration: text("signer_registration").notNull(),
    signerUf: text("signer_uf").notNull(),
    conclusion: text("conclusion").$type<"fit" | "unfit">().notNull(),
    signedOn: date("signed_on").notNull(),
    storagePath: text("storage_path").notNull(),
    fileSha256: text("file_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    replacesId: uuid("replaces_id"),
    replaceReason: text("replace_reason"),
    registeredBy: text("registered_by").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_aso_signed_company",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_aso_signed_exam",
      columns: [t.healthExamId, t.orgId, t.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }),
    foreignKey({
      name: "fk_aso_signed_preview",
      columns: [t.previewDocumentId],
      foreignColumns: [asoDocuments.id],
    }),
    // Substituição só dentro do mesmo exame e tenant (FK composta; sem consulta recursiva na policy).
    uniqueIndex("uq_aso_signed_id_scope").on(t.id, t.orgId, t.healthExamId),
    foreignKey({
      name: "fk_aso_signed_replaces",
      columns: [t.replacesId, t.orgId, t.healthExamId],
      foreignColumns: [t.id, t.orgId, t.healthExamId],
    }),
    uniqueIndex("uq_aso_signed_replaces").on(t.replacesId),
    uniqueIndex("uq_aso_signed_storage_path").on(t.storagePath),
    index("idx_aso_signed_exam").on(t.orgId, t.healthExamId, t.registeredAt),
    check("ck_aso_signed_origin", sql`${t.origin} in ('examiner','external_clinic')`),
    check(
      "ck_aso_signed_preview",
      sql`(${t.origin} = 'examiner') = (${t.previewDocumentId} is not null)`,
    ),
    check(
      "ck_aso_signed_method",
      sql`${t.signatureMethod} in ('icp_brasil','electronic','handwritten')`,
    ),
    check(
      "ck_aso_signed_verification",
      sql`char_length(btrim(${t.verificationReference})) >= 5`,
    ),
    check("ck_aso_signed_conclusion", sql`${t.conclusion} in ('fit','unfit')`),
    check("ck_aso_signed_uf", sql`${t.signerUf} ~ '^[A-Z]{2}$'`),
    check(
      "ck_aso_signed_signer",
      sql`btrim(${t.signerName}) <> '' and btrim(${t.signerRegistration}) <> ''`,
    ),
    check("ck_aso_signed_hash", sql`${t.fileSha256} ~ '^[0-9a-f]{64}$'`),
    check("ck_aso_signed_size", sql`${t.sizeBytes} > 0`),
    check(
      "ck_aso_signed_replace",
      sql`(${t.replacesId} is null) = (${t.replaceReason} is null) and (${t.replaceReason} is null or char_length(btrim(${t.replaceReason})) >= 10)`,
    ),
    check(
      "ck_aso_signed_not_self",
      sql`${t.replacesId} is null or ${t.replacesId} <> ${t.id}`,
    ),
    pgPolicy("aso_signed_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("aso_signed_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Fluxo A: só o examinador do exame com identidade verificada, CRM/UF do cadastro dele e prévia
    // do mesmo exame. Fluxo B: só a equipe do escritório. Substituição: garantida pela FK composta.
    pgPolicy("aso_signed_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.registeredBy} = current_setting('app.current_actor', true)
        and exists (select 1 from public.health_exams h where h.id = ${t.healthExamId} and h.org_id = ${t.orgId} and h.company_id = ${t.companyId})
        and (
          (${t.origin} = 'examiner'
            and exists (select 1 from public.health_exams h join public.medicos m on m.id = h.doctor_id and m.org_id = h.org_id
              where h.id = ${t.healthExamId} and h.org_id = ${t.orgId}
                and m.crm = ${t.signerRegistration} and m.registration_uf = ${t.signerUf}
                and h.doctor_id in (select public.actor_clinical_medico_ids(h.org_id)))
            and exists (select 1 from public.aso_documents d where d.id = ${t.previewDocumentId} and d.org_id = ${t.orgId} and d.health_exam_id = ${t.healthExamId}))
          or (${t.origin} = 'external_clinic'
            and exists (select 1 from public.org_memberships om where om.org_id = ${t.orgId}
              and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))
        )`,
    }),
  ],
).enableRLS();

export type AsoSignedDocument = InferSelectModel<typeof asoSignedDocuments>;
