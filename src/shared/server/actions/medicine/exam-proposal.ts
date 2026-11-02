"use server";
import { officeAction } from "@/shared/server/office-action";
import {
  getCatalogProcedure,
  getExamProposal,
  searchProcedureCatalog,
} from "@/shared/server/medicine/exam-proposal-core";
import type { PageParams } from "@/shared/pagination";

export async function searchProceduresAction(search: string, page: PageParams = {}) {
  return officeAction("medicine.procedures.search", async () =>
    searchProcedureCatalog({ search }, page),
  );
}

export async function getProcedureAction(code: string) {
  return officeAction("medicine.procedures.get", async () => getCatalogProcedure(code));
}

export async function getExamProposalAction(companyId: string) {
  return officeAction("medicine.exam_proposal.get", (ctx) =>
    getExamProposal(ctx, companyId),
  );
}
