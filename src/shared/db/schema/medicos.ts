import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { companyModuleScope } from "./module-policy";

export const medicoStatus = pgEnum("medico_status", ["active", "inactive"]);

/** Categoria profissional (NOB-121): médico (CRM) ou psicólogo (CRP). */
export const medicalProfession = pgEnum("medical_profession", [
  "physician",
  "psychologist",
]);

/** Vínculo com o escritório: equipe própria ou profissional externo (clínica, indicado pela empresa). */
export const medicalAffiliation = pgEnum("medical_affiliation", ["internal", "external"]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
// Mesmo predicado de owner da 0056 (NOB-98): ator da sessão com papel owner no tenant.
const actorIsOwner = sql`exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))`;

/**
 * Cadastro de profissionais de saúde (médicos e psicólogos) do escritório,
 * isolado por tenant. `crm` guarda o número do registro no conselho da
 * profissão (CRM para médico, CRP para psicólogo) e `registration_uf` a UF do
 * conselho. `rqe` é o Registro de Qualificação de Especialista (Medicina do
 * Trabalho), só para médicos. `clinic` é a clínica/empregador do profissional
 * (texto livre — não é a empresa-cliente do tenant). Registro único por org.
 */
export const medicos = pgTable(
  "medicos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    crm: text("crm").notNull(),
    profession: medicalProfession("profession").notNull().default("physician"),
    registrationUf: text("registration_uf"),
    rqe: text("rqe"),
    affiliation: medicalAffiliation("affiliation").notNull().default("internal"),
    specialty: text("specialty"),
    clinic: text("clinic"),
    phone: text("phone"),
    status: medicoStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_medicos_org_id").on(table.orgId),
    uniqueIndex("uq_medicos_org_crm").on(table.orgId, table.crm),
    // Alvo das FKs compostas (id, org_id): impede vínculo com profissional de outro tenant.
    uniqueIndex("uq_medicos_id_org").on(table.id, table.orgId),
    check(
      "ck_medicos_registration_uf",
      sql`${table.registrationUf} is null or ${table.registrationUf} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "ck_medicos_rqe_physician",
      sql`${table.rqe} is null or ${table.profession} = 'physician'`,
    ),
    pgPolicy("medicos_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Medico = InferSelectModel<typeof medicos>;
export type NewMedico = InferInsertModel<typeof medicos>;

/**
 * Designação do médico responsável (coordenador) pelo PCMSO de uma
 * empresa-cliente, por período (MED-02; NR-7 7.4.1 "c"). Histórico
 * preservado: trocar de coordenador encerra a designação aberta (`ends_on`)
 * e cria outra; o app_runtime não pode apagar linhas. No máximo uma
 * designação aberta por empresa. `rqe_exception_reason` registra a exceção do
 * NR-7 7.5.2 (sem médico do trabalho na localidade) quando o médico não tem RQE.
 */
export const pcmsoCoordinatorAssignments = pgTable(
  "pcmso_coordinator_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    medicoId: uuid("medico_id").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    rqeExceptionReason: text("rqe_exception_reason"),
    endReason: text("end_reason"),
    createdBy: text("created_by").notNull(),
    endedBy: text("ended_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.medicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    index("idx_pcmso_coordinators_company").on(t.orgId, t.companyId, t.startsOn),
    index("idx_pcmso_coordinators_medico").on(t.medicoId),
    uniqueIndex("uq_pcmso_coordinators_open")
      .on(t.orgId, t.companyId)
      .where(sql`${t.endsOn} is null`),
    check(
      "ck_pcmso_coordinators_period",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
    check(
      "ck_pcmso_coordinators_end_reason",
      sql`(${t.endsOn} is null) = (${t.endReason} is null)`,
    ),
    pgPolicy("pcmso_coordinators_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_coordinators_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    pgPolicy("pcmso_coordinators_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${actorIsOwner} and ${t.createdBy} = current_setting('app.current_actor', true)`,
    }),
    // Só uma designação ABERTA pode ser alterada (encerrada); encerrada não reabre nem muda.
    pgPolicy("pcmso_coordinators_owner_close", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`${t.endsOn} is null and ${actorIsOwner}`,
      withCheck: sql`${t.endedBy} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export type PcmsoCoordinatorAssignment = InferSelectModel<
  typeof pcmsoCoordinatorAssignments
>;
