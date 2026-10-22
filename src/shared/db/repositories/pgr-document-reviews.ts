import "server-only";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import type {
  PgrReviewSampleInput,
  PgrReviewDecisionInput,
} from "@/shared/domains/pgr/document-review";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import { withOrg } from "../with-org";
import { pgr } from "../schema/pgr";
import { documents } from "../schema/documents";
import {
  pgrReviewSamples as samples,
  pgrReviewDecisions as decisions,
} from "../schema/pgr-document-reviews";
import { auditedTenantWrite } from "./audited-write";
type SampleArtifact = {
  fileName: string;
  storagePath: string;
  sizeBytes: number;
  documentGroupId: string;
  snapshot: Record<string, unknown>;
  snapshotSha256: string;
  templateSha256: string;
  fileSha256: string;
};
export async function createPgrReviewSample(
  ctx: TenantContext,
  pgrId: string,
  input: PgrReviewSampleInput,
  artifact: SampleArtifact,
) {
  return auditedTenantWrite(ctx.tenantId, "pgr.review.sample", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
      const [head] = await tx
        .select({ id: pgr.id })
        .from(pgr)
        .where(and(eq(pgr.orgId, ctx.tenantId), eq(pgr.id, pgrId)))
        .limit(1);
      if (!head) throw new NotFoundError();
      if (input.supersedesSampleId) {
        const [previous] = await tx
          .select({ id: samples.id })
          .from(samples)
          .where(
            and(
              eq(samples.orgId, ctx.tenantId),
              eq(samples.pgrId, pgrId),
              eq(samples.id, input.supersedesSampleId),
            ),
          )
          .limit(1);
        if (!previous)
          throw new ValidationError("A amostra anterior deve pertencer a este PGR.");
      }
      const [document] = await tx
        .insert(documents)
        .values({
          orgId: ctx.tenantId,
          documentGroupId: artifact.documentGroupId,
          name: `Amostra para revisão — ${artifact.fileName}`,
          docType: "PGR — amostra de revisão",
          storagePath: artifact.storagePath,
          sizeBytes: artifact.sizeBytes,
          relatedEntityType: "pgr",
          relatedEntityId: pgrId,
        })
        .returning({ id: documents.id });
      const [row] = await tx
        .insert(samples)
        .values({
          orgId: ctx.tenantId,
          pgrId,
          documentId: document.id,
          supersedesSampleId: input.supersedesSampleId,
          snapshot: artifact.snapshot,
          snapshotSha256: artifact.snapshotSha256,
          templateSha256: artifact.templateSha256,
          fileSha256: artifact.fileSha256,
          createdBy: ctx.userId,
          reason: input.reason,
        })
        .returning();
      return row;
    }),
  );
}
export async function listPgrReviewSamples(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  return withOrg(ctx.tenantId, async (tx) => {
    const [head] = await tx
      .select({ id: pgr.id })
      .from(pgr)
      .where(and(eq(pgr.orgId, ctx.tenantId), eq(pgr.id, pgrId)))
      .limit(1);
    if (!head) throw new NotFoundError();
    const { limit, offset } = resolvePageParams(page);
    const rows = await tx
      .select({
        id: samples.id,
        pgrId: samples.pgrId,
        documentId: samples.documentId,
        supersedesSampleId: samples.supersedesSampleId,
        snapshotSha256: samples.snapshotSha256,
        templateSha256: samples.templateSha256,
        fileSha256: samples.fileSha256,
        createdBy: samples.createdBy,
        createdAt: samples.createdAt,
        reason: samples.reason,
      })
      .from(samples)
      .where(and(eq(samples.orgId, ctx.tenantId), eq(samples.pgrId, pgrId)))
      .orderBy(desc(samples.createdAt), desc(samples.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(samples)
      .where(and(eq(samples.orgId, ctx.tenantId), eq(samples.pgrId, pgrId)));
    const latest = rows.length
      ? await tx
          .selectDistinctOn([decisions.sampleId])
          .from(decisions)
          .where(
            and(
              eq(decisions.orgId, ctx.tenantId),
              inArray(
                decisions.sampleId,
                rows.map((r) => r.id),
              ),
            ),
          )
          .orderBy(decisions.sampleId, desc(decisions.recordedAt), desc(decisions.id))
      : [];
    return {
      rows: rows.map((row) => ({
        ...row,
        latestDecision: latest.find((d) => d.sampleId === row.id) ?? null,
      })),
      total,
    };
  });
}
export async function getPgrReviewSample(
  ctx: TenantContext,
  pgrId: string,
  sampleId: string,
  page: PageParams = {},
) {
  return withOrg(ctx.tenantId, async (tx) => {
    const [sample] = await tx
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.orgId, ctx.tenantId),
          eq(samples.pgrId, pgrId),
          eq(samples.id, sampleId),
        ),
      )
      .limit(1);
    if (!sample) throw new NotFoundError();
    const { limit, offset } = resolvePageParams(page);
    const history = await tx
      .select()
      .from(decisions)
      .where(and(eq(decisions.orgId, ctx.tenantId), eq(decisions.sampleId, sampleId)))
      .orderBy(desc(decisions.recordedAt), desc(decisions.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(decisions)
      .where(and(eq(decisions.orgId, ctx.tenantId), eq(decisions.sampleId, sampleId)));
    const [latest] = await tx
      .select()
      .from(decisions)
      .where(and(eq(decisions.orgId, ctx.tenantId), eq(decisions.sampleId, sampleId)))
      .orderBy(desc(decisions.recordedAt), desc(decisions.id))
      .limit(1);
    const [parent] =
      !latest && sample.supersedesSampleId
        ? await tx
            .select()
            .from(decisions)
            .where(
              and(
                eq(decisions.orgId, ctx.tenantId),
                eq(decisions.sampleId, sample.supersedesSampleId),
              ),
            )
            .orderBy(desc(decisions.recordedAt), desc(decisions.id))
            .limit(1)
        : [];
    return {
      sample,
      latestDecision: latest ?? null,
      previousFindings: latest?.data.findings ?? parent?.data.findings ?? [],
      history: { rows: history, total },
    };
  });
}
export async function recordPgrReviewDecision(
  ctx: TenantContext,
  pgrId: string,
  sampleId: string,
  input: PgrReviewDecisionInput,
) {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o owner pode registrar o parecer recebido do responsável técnico.",
    );
  if (Date.parse(input.reviewedAt) > Date.now())
    throw new ValidationError("A data informada do parecer não pode estar no futuro.");
  return auditedTenantWrite(ctx.tenantId, "pgr.review.decision", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${sampleId},107))`,
      );
      const [sample] = await tx
        .select()
        .from(samples)
        .where(
          and(
            eq(samples.orgId, ctx.tenantId),
            eq(samples.pgrId, pgrId),
            eq(samples.id, sampleId),
          ),
        )
        .limit(1);
      if (!sample) throw new NotFoundError();
      const [latest] = await tx
        .select()
        .from(decisions)
        .where(and(eq(decisions.orgId, ctx.tenantId), eq(decisions.sampleId, sampleId)))
        .orderBy(desc(decisions.recordedAt), desc(decisions.id))
        .limit(1);
      if ((latest?.id ?? null) !== input.expectedLatestDecisionId)
        throw new ValidationError(
          "Outro parecer foi registrado. Atualize a página antes de continuar.",
        );
      let previous = latest;
      if (!previous && sample.supersedesSampleId) {
        const [prior] = await tx
          .select()
          .from(decisions)
          .where(
            and(
              eq(decisions.orgId, ctx.tenantId),
              eq(decisions.sampleId, sample.supersedesSampleId),
            ),
          )
          .orderBy(desc(decisions.recordedAt), desc(decisions.id))
          .limit(1);
        previous = prior;
      }
      for (const finding of previous?.data.findings ?? []) {
        const next = input.findings.find((f) => f.key === finding.key);
        if (!next)
          throw new ValidationError(
            `Mantenha o achado ${finding.key} na revalidação, registrando sua situação.`,
          );
        if (
          finding.severity === "blocking" &&
          finding.resolution === "open" &&
          next.severity !== "blocking"
        )
          throw new ValidationError(
            "Achado impeditivo precisa de correção referenciada; não pode ser ocultado reduzindo sua severidade.",
          );
      }
      const [row] = await tx
        .insert(decisions)
        .values({
          orgId: ctx.tenantId,
          sampleId,
          status: input.status,
          data: input,
          recordedBy: ctx.userId,
        })
        .returning();
      return row;
    }),
  );
}
