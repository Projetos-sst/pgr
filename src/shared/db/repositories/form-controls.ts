import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  FormControlDetail,
  FormControlListItem,
  FormControlValues,
} from "@/shared/domains/documents/form-controls";
import { toFormControlListItem } from "@/shared/domains/documents/form-controls";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { companies, formControls, ges } from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "documents.form_controls.write_rejected";
const countExpr = sql<number>`count(*)::int`;

export type ListFormControlsParams = PageParams & {
  search?: string;
  formType?: string;
  companyId?: string;
  status?: string;
  type?: string;
};

export async function listFormControls(
  orgId: string,
  params: ListFormControlsParams = {},
): Promise<Paginated<FormControlListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(formControls.orgId, orgId)];
  const search = params.search?.trim();
  if (search) {
    filters.push(
      or(
        ilike(formControls.frmCode, `%${search}%`),
        ilike(formControls.formType, `%${search}%`),
      ) as SQL,
    );
  }
  if (params.formType) filters.push(eq(formControls.formType, params.formType));
  if (params.companyId) filters.push(eq(formControls.companyId, params.companyId));
  if (params.status) filters.push(eq(formControls.status, params.status as never));
  if (params.type) filters.push(eq(formControls.type, params.type as never));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: formControls.id,
        formType: formControls.formType,
        companyName: companies.razaoSocial,
        frmCode: formControls.frmCode,
        revision: formControls.revision,
        issueDate: formControls.issueDate,
        position: formControls.position,
        type: formControls.type,
        status: formControls.status,
      })
      .from(formControls)
      .leftJoin(companies, eq(companies.id, formControls.companyId))
      .where(where)
      .orderBy(desc(formControls.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(formControls)
      .where(where);
    return { rows: rows.map(toFormControlListItem), total };
  });
}

export async function getFormControlById(
  orgId: string,
  id: string,
): Promise<FormControlDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [control] = await tx
      .select()
      .from(formControls)
      .where(and(eq(formControls.orgId, orgId), eq(formControls.id, id)))
      .limit(1);
    if (!control) return null;

    const [company] = control.companyId
      ? await tx
          .select({ id: companies.id, razaoSocial: companies.razaoSocial })
          .from(companies)
          .where(eq(companies.id, control.companyId))
          .limit(1)
      : [];
    const [gesRow] = control.gesId
      ? await tx
          .select({ id: ges.id, name: ges.name })
          .from(ges)
          .where(eq(ges.id, control.gesId))
          .limit(1)
      : [];

    return { control, company: company ?? null, ges: gesRow ?? null };
  });
}

async function assertCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string | null | undefined,
): Promise<void> {
  if (!companyId) return;
  const [row] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("company");
}

async function assertGes(
  tx: TenantTransaction,
  orgId: string,
  gesId: string | null | undefined,
): Promise<void> {
  if (!gesId) return;
  const [row] = await tx
    .select({ id: ges.id })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}

function toColumns(input: FormControlValues) {
  return {
    formType: input.formType,
    companyId: input.companyId ?? null,
    frmCode: input.frmCode,
    revision: input.revision,
    issueDate: input.issueDate,
    nonConformityNumber: input.nonConformityNumber ?? null,
    gesId: input.gesId ?? null,
    position: input.position,
    type: input.type,
    status: input.status,
    notes: input.notes ?? null,
  };
}

export async function createFormControl(
  orgId: string,
  input: FormControlValues,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompany(tx, orgId, input.companyId);
      await assertGes(tx, orgId, input.gesId);
      // Código FRM duplicado por org viola uq_form_controls_org_frm_code (23505) → DUPLICATE.
      const [row] = await tx
        .insert(formControls)
        .values({ orgId, ...toColumns(input) })
        .returning({ id: formControls.id });
      return { id: row.id };
    }),
  );
}

export async function updateFormControl(
  orgId: string,
  id: string,
  input: FormControlValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompany(tx, orgId, input.companyId);
      await assertGes(tx, orgId, input.gesId);
      const [row] = await tx
        .update(formControls)
        .set({ ...toColumns(input), updatedAt: new Date() })
        .where(and(eq(formControls.orgId, orgId), eq(formControls.id, id)))
        .returning({ id: formControls.id });
      return !!row;
    }),
  );
}

export async function deleteFormControl(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(formControls)
        .where(and(eq(formControls.orgId, orgId), eq(formControls.id, id)))
        .returning({ id: formControls.id });
      return rows.length > 0;
    }),
  );
}
