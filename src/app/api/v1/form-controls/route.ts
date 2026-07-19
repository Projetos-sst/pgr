import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { formControlInputSchema } from "@/shared/domains/documents/form-controls";
import * as repo from "@/shared/db/repositories/form-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function paramsFrom(req: NextRequest): repo.ListFormControlsParams {
  const searchParams = req.nextUrl.searchParams;
  return {
    ...pageParamsFrom(req),
    formType: searchParams.get("formType") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
  };
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listFormControls(tenantId, paramsFrom(req)),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = formControlInputSchema.parse(await req.json());
      return repo.createFormControl(tenantId, input);
    },
    { status: 201 },
  );
}
