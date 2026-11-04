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
import { medicalExamPlans } from "./medical-exam-plans";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Versões do PCMSO composto (NOB-151). Cada versão é um arquivo imutável: conteúdo JSON com hash
 * SHA-256, plano de exames aprovado de origem e vigência. Só existe o status `preview`: emissão
 * oficial exige assinatura médica verificável (MED-12), que ainda não existe — o CHECK impede
 * gravar outro status. Sem UPDATE nem DELETE para o `app_runtime`.
 */
export const pcmsoDocuments = pgTable(
  "pcmso_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("preview"),
    cycleStart: date("cycle_start").notNull(),
    cycleEnd: date("cycle_end").notNull(),
    examPlanId: uuid("exam_plan_id").notNull(),
    content: jsonb("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_pcmso_documents_version").on(t.orgId, t.companyId, t.version),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.examPlanId, t.orgId, t.companyId],
      foreignColumns: [
        medicalExamPlans.id,
        medicalExamPlans.orgId,
        medicalExamPlans.companyId,
      ],
    }).onDelete("restrict"),
    index("idx_pcmso_documents_company").on(t.orgId, t.companyId, t.version),
    // Alvo da FK composta do PCMSO assinado (NOB-166): prévia da mesma empresa e tenant.
    uniqueIndex("uq_pcmso_documents_id_scope").on(t.id, t.orgId, t.companyId),
    check("ck_pcmso_documents_status", sql`${t.status} = 'preview'`),
    check("ck_pcmso_documents_version", sql`${t.version} > 0`),
    check("ck_pcmso_documents_cycle", sql`${t.cycleEnd} > ${t.cycleStart}`),
    check("ck_pcmso_documents_hash", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    pgPolicy("pcmso_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // A versão só pode nascer de um plano APROVADO da mesma empresa, com o ator como autor.
    pgPolicy("pcmso_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.generatedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.medical_exam_plans p where p.id = ${t.examPlanId} and p.org_id = ${t.orgId} and p.company_id = ${t.companyId} and p.status = 'approved')`,
    }),
  ],
).enableRLS();

export type PcmsoDocument = InferSelectModel<typeof pcmsoDocuments>;

export type PcmsoSignedOrigin = "coordinator" | "office_received";
export type PcmsoSignatureMethod = "icp_brasil" | "electronic" | "handwritten";
export type PcmsoChangeKind =
  | "administrative"
  | "documentary_update"
  | "clinical_revision"
  | "correction";

/**
 * PCMSO assinado arquivado (NOB-166; MED-02, MED-11, MED-12, MED-14; NR-7 7.4.1 "c", 7.5.4). A
 * versão oficial é o PDF de uma **prévia do sistema** assinado pelo médico responsável designado:
 * - `coordinator`: o próprio coordenador designado, pela conta vinculada e verificada, registra;
 * - `office_received`: a equipe arquiva o documento que o coordenador designado assinou e devolveu.
 * O signatário (CRM/UF) é sempre o coordenador designado vigente; a prévia é da mesma empresa, com
 * o mesmo hash e o plano aprovado vigente. A conferência é **documental** (validador ou original
 * físico): o sistema não valida assinatura criptograficamente e não declara isso. Correção ou
 * atualização = nova linha que substitui a anterior, com tipo de mudança e motivo (MED-14).
 */
export const pcmsoSignedDocuments = pgTable(
  "pcmso_signed_documents",
  {
    id: uuid("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    previewDocumentId: uuid("preview_document_id").notNull(),
    previewSha256: text("preview_sha256").notNull(),
    examPlanId: uuid("exam_plan_id").notNull(),
    origin: text("origin").$type<PcmsoSignedOrigin>().notNull(),
    signatureMethod: text("signature_method").$type<PcmsoSignatureMethod>().notNull(),
    signerName: text("signer_name").notNull(),
    signerRegistration: text("signer_registration").notNull(),
    signerUf: text("signer_uf").notNull(),
    signedOn: date("signed_on").notNull(),
    verificationKind: text("verification_kind").notNull().default("documentary"),
    verificationReference: text("verification_reference").notNull(),
    storagePath: text("storage_path").notNull(),
    fileSha256: text("file_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    replacesId: uuid("replaces_id"),
    changeKind: text("change_kind").$type<PcmsoChangeKind>(),
    replaceReason: text("replace_reason"),
    registeredBy: text("registered_by").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_pcmso_signed_company",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_pcmso_signed_preview",
      columns: [t.previewDocumentId, t.orgId, t.companyId],
      foreignColumns: [pcmsoDocuments.id, pcmsoDocuments.orgId, pcmsoDocuments.companyId],
    }),
    foreignKey({
      name: "fk_pcmso_signed_plan",
      columns: [t.examPlanId, t.orgId, t.companyId],
      foreignColumns: [
        medicalExamPlans.id,
        medicalExamPlans.orgId,
        medicalExamPlans.companyId,
      ],
    }),
    uniqueIndex("uq_pcmso_signed_id_scope").on(t.id, t.orgId, t.companyId),
    foreignKey({
      name: "fk_pcmso_signed_replaces",
      columns: [t.replacesId, t.orgId, t.companyId],
      foreignColumns: [t.id, t.orgId, t.companyId],
    }),
    uniqueIndex("uq_pcmso_signed_replaces").on(t.replacesId),
    uniqueIndex("uq_pcmso_signed_storage_path").on(t.storagePath),
    index("idx_pcmso_signed_company").on(t.orgId, t.companyId, t.registeredAt),
    check(
      "ck_pcmso_signed_origin",
      sql`${t.origin} in ('coordinator','office_received')`,
    ),
    check(
      "ck_pcmso_signed_method",
      sql`${t.signatureMethod} in ('icp_brasil','electronic','handwritten')`,
    ),
    // Só conferência documental existe hoje; validação criptográfica não é representável.
    check(
      "ck_pcmso_signed_verification_kind",
      sql`${t.verificationKind} = 'documentary'`,
    ),
    check(
      "ck_pcmso_signed_verification",
      sql`char_length(btrim(${t.verificationReference})) >= 5`,
    ),
    check("ck_pcmso_signed_uf", sql`${t.signerUf} ~ '^[A-Z]{2}$'`),
    check(
      "ck_pcmso_signed_signer",
      sql`btrim(${t.signerName}) <> '' and btrim(${t.signerRegistration}) <> ''`,
    ),
    check(
      "ck_pcmso_signed_hashes",
      sql`${t.fileSha256} ~ '^[0-9a-f]{64}$' and ${t.previewSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check("ck_pcmso_signed_size", sql`${t.sizeBytes} > 0`),
    check(
      "ck_pcmso_signed_replace",
      sql`(${t.replacesId} is null) = (${t.replaceReason} is null)
        and (${t.replacesId} is null) = (${t.changeKind} is null)
        and (${t.changeKind} is null or ${t.changeKind} in ('administrative','documentary_update','clinical_revision','correction'))
        and (${t.replaceReason} is null or char_length(btrim(${t.replaceReason})) >= 10)
        and (${t.replacesId} is null or ${t.replacesId} <> ${t.id})`,
    ),
    pgPolicy("pcmso_signed_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_signed_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Ator como autor; prévia da mesma empresa com o mesmo hash e o mesmo plano, aprovado; signatário
    // = coordenador designado vigente; fluxo A só pela conta verificada desse coordenador, fluxo B
    // só pela equipe do escritório.
    pgPolicy("pcmso_signed_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.registeredBy} = current_setting('app.current_actor', true)
        and exists (select 1 from public.pcmso_documents d where d.id = ${t.previewDocumentId} and d.org_id = ${t.orgId}
          and d.company_id = ${t.companyId} and d.content_sha256 = ${t.previewSha256} and d.exam_plan_id = ${t.examPlanId})
        and exists (select 1 from public.medical_exam_plans p where p.id = ${t.examPlanId} and p.org_id = ${t.orgId}
          and p.company_id = ${t.companyId} and p.status = 'approved')
        and exists (select 1 from public.pcmso_coordinator_assignments a join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id
          where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.ends_on is null
            and m.crm = ${t.signerRegistration} and m.registration_uf = ${t.signerUf}
            and (${t.origin} <> 'coordinator' or a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        and (${t.origin} <> 'office_received' or exists (select 1 from public.org_memberships om where om.org_id = ${t.orgId}
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))`,
    }),
  ],
).enableRLS();

export type PcmsoSignedDocument = InferSelectModel<typeof pcmsoSignedDocuments>;
