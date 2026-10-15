import "server-only";

import { db } from "../index";
import { platformLeads } from "../schema/platform-leads";
import type { LeadValues } from "@/shared/domains/platform/leads";

/**
 * Gravação do pré-cadastro público.
 *
 * Não passa por `withOrg` porque a tabela é global e o visitante não tem tenant
 * (ver o cabeçalho de `schema/platform-leads.ts`). Não há função de leitura
 * neste repositório **de propósito**: o papel `app_runtime` não tem GRANT de
 * SELECT nesta tabela, então uma consulta aqui falharia — e a ausência da
 * função é o lembrete de que não existe leitura pública de leads.
 *
 * O `INSERT` não devolve colunas: sem SELECT no GRANT, um `returning()` seria
 * negado pelo banco. O retorno é só o fato de ter gravado.
 */
export async function createLead(values: LeadValues): Promise<void> {
  await db.insert(platformLeads).values({
    name: values.name,
    company: values.company,
    email: values.email,
    phone: values.phone,
    interest: values.interest,
    message: values.message ?? null,
    source: values.source,
  });
}
