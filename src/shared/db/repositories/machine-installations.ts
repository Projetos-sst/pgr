import "server-only";
import { and, eq, desc, asc, or, isNull, sql } from "drizzle-orm";
import type { MachineInstallationInput } from "@/shared/domains/pgr/machine-installation";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import { withOrg, type TenantTransaction } from "../with-org";
import {
  machineInstallations as machines,
  machineInstallationEvents as events,
} from "../schema/machine-installations";
import { workUnits } from "../schema/work-units";
import { ges } from "../schema/ges";
import { epiCatalog } from "../schema/epis";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";

async function references(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  input: MachineInstallationInput,
) {
  const [unit] = await tx
    .select({ id: workUnits.id })
    .from(workUnits)
    .where(
      and(
        eq(workUnits.id, input.workUnitId),
        eq(workUnits.orgId, orgId),
        eq(workUnits.companyId, companyId),
      ),
    )
    .limit(1);
  if (!unit)
    throw new ReferenceNotFoundError("A obra deve pertencer à empresa selecionada.");
  if (input.gesId) {
    const [group] = await tx
      .select({ id: ges.id })
      .from(ges)
      .where(
        and(
          eq(ges.id, input.gesId),
          eq(ges.orgId, orgId),
          eq(ges.companyId, companyId),
          eq(ges.workUnitId, input.workUnitId),
        ),
      )
      .limit(1);
    if (!group)
      throw new ReferenceNotFoundError(
        "O GES deve pertencer à empresa e à obra selecionadas.",
      );
  }
  const [item] = await tx
    .select({ name: epiCatalog.name, manufacturer: epiCatalog.manufacturer })
    .from(epiCatalog)
    .where(
      and(
        eq(epiCatalog.id, input.catalogId),
        eq(epiCatalog.orgId, orgId),
        eq(epiCatalog.type, "machine"),
        or(isNull(epiCatalog.companyId), eq(epiCatalog.companyId, companyId)),
      ),
    )
    .limit(1);
  if (!item)
    throw new ReferenceNotFoundError(
      "Selecione uma máquina do catálogo compatível com esta empresa.",
    );
  return { catalogName: item.name, manufacturer: item.manufacturer };
}
export async function listMachineInstallations(
  orgId: string,
  companyId: string,
  params: PageParams & { includeInactive?: boolean } = {},
) {
  return withOrg(orgId, async (tx) => {
    await assertCompanyModuleTx(tx, orgId, companyId, "pgr");
    const { limit, offset } = resolvePageParams(params);
    const where = and(
      eq(machines.orgId, orgId),
      eq(machines.companyId, companyId),
      params.includeInactive ? undefined : eq(machines.active, true),
    );
    const rows = await tx
      .select()
      .from(machines)
      .where(where)
      .orderBy(asc(machines.catalogName), asc(machines.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(machines)
      .where(where);
    return { rows, total };
  });
}
export async function getMachineInstallation(
  orgId: string,
  companyId: string,
  id: string,
  page: PageParams = {},
) {
  return withOrg(orgId, async (tx) => {
    await assertCompanyModuleTx(tx, orgId, companyId, "pgr");
    const [row] = await tx
      .select()
      .from(machines)
      .where(
        and(
          eq(machines.orgId, orgId),
          eq(machines.companyId, companyId),
          eq(machines.id, id),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundError();
    const { limit, offset } = resolvePageParams(page);
    const history = await tx
      .select()
      .from(events)
      .where(and(eq(events.orgId, orgId), eq(events.installationId, id)))
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.orgId, orgId), eq(events.installationId, id)));
    return { installation: row, history: { rows: history, total } };
  });
}
export async function saveMachineInstallation(
  orgId: string,
  companyId: string,
  actor: string,
  input: MachineInstallationInput,
  update?: { id: string; expectedVersion: number },
) {
  return auditedTenantWrite(orgId, "pgr.machine.write", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyModuleTx(tx, orgId, companyId, "pgr");
      let previous: typeof machines.$inferSelect | null = null;
      if (update) {
        const [row] = await tx
          .select()
          .from(machines)
          .where(
            and(
              eq(machines.orgId, orgId),
              eq(machines.companyId, companyId),
              eq(machines.id, update.id),
            ),
          )
          .for("update")
          .limit(1);
        if (!row) throw new NotFoundError();
        if (row.version !== update.expectedVersion)
          throw new ValidationError(
            "A máquina foi alterada. Atualize a página antes de salvar.",
          );
        if (!row.active)
          throw new ValidationError(
            "O vínculo foi retirado. Registre um novo vínculo para utilizar a máquina novamente.",
          );
        previous = row;
      }
      const snapshot = await references(tx, orgId, companyId, input);
      const { reason, ...data } = input;
      const values = {
        ...data,
        ...snapshot,
        updatedBy: actor,
        updatedAt: new Date(),
        version: (previous?.version ?? 0) + 1,
      };
      const [row] = update
        ? await tx
            .update(machines)
            .set(values)
            .where(eq(machines.id, update.id))
            .returning()
        : await tx
            .insert(machines)
            .values({ ...values, orgId, companyId, createdBy: actor })
            .returning();
      await tx.insert(events).values({
        orgId,
        companyId,
        installationId: row.id,
        actor,
        event: previous ? "updated" : "created",
        reason,
        snapshot: { previous, next: row },
      });
      return row;
    }),
  );
}
export async function archiveMachineInstallation(
  orgId: string,
  companyId: string,
  id: string,
  actor: string,
  expectedVersion: number,
  reason: string,
) {
  return auditedTenantWrite(orgId, "pgr.machine.archive", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyModuleTx(tx, orgId, companyId, "pgr");
      const [previous] = await tx
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.orgId, orgId),
            eq(machines.companyId, companyId),
            eq(machines.id, id),
          ),
        )
        .for("update")
        .limit(1);
      if (!previous) throw new NotFoundError();
      if (previous.version !== expectedVersion)
        throw new ValidationError(
          "A máquina foi alterada. Atualize a página antes de retirar.",
        );
      if (!previous.active) return previous;
      const [row] = await tx
        .update(machines)
        .set({
          active: false,
          version: previous.version + 1,
          updatedBy: actor,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, id))
        .returning();
      await tx.insert(events).values({
        orgId,
        companyId,
        installationId: id,
        actor,
        event: "archived",
        reason,
        snapshot: { previous, next: row },
      });
      return row;
    }),
  );
}
export async function machineInstallationOptions(orgId: string, companyId: string) {
  return withOrg(orgId, async (tx) => {
    await assertCompanyModuleTx(tx, orgId, companyId, "pgr");
    const units = await tx
      .select({ id: workUnits.id, name: workUnits.name })
      .from(workUnits)
      .where(and(eq(workUnits.orgId, orgId), eq(workUnits.companyId, companyId)))
      .orderBy(workUnits.name)
      .limit(101);
    const groups = await tx
      .select({ id: ges.id, name: ges.name, workUnitId: ges.workUnitId })
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.companyId, companyId)))
      .orderBy(ges.name)
      .limit(101);
    const catalog = await tx
      .select({ id: epiCatalog.id, name: epiCatalog.name })
      .from(epiCatalog)
      .where(
        and(
          eq(epiCatalog.orgId, orgId),
          eq(epiCatalog.type, "machine"),
          or(isNull(epiCatalog.companyId), eq(epiCatalog.companyId, companyId)),
        ),
      )
      .orderBy(epiCatalog.name)
      .limit(101);
    return {
      units: units.slice(0, 100),
      groups: groups.slice(0, 100),
      catalog: catalog.slice(0, 100),
      truncated: units.length > 100 || groups.length > 100 || catalog.length > 100,
    };
  });
}
