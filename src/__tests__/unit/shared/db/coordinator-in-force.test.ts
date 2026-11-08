/**
 * Fragmento SQL único da permissão do coordenador (NOB-109): designação em vigor hoje no
 * calendário de São Paulo (início <= hoje, fim nulo ou >= hoje) e nenhuma outra designação da
 * empresa em vigor no mesmo dia (sobreposição nega). O comportamento no banco é coberto na
 * integração (`coordinator-permission-in-force`).
 */
import { PgDialect } from "drizzle-orm/pg-core";

import {
  coordinatorAssignmentInForceToday,
  saoPauloTodaySql,
} from "@/shared/db/schema/coordinator-in-force";

const render = (fragment: Parameters<PgDialect["sqlToQuery"]>[0]) =>
  new PgDialect().sqlToQuery(fragment);

describe("coordinatorAssignmentInForceToday", () => {
  const TODAY = "(now() at time zone 'America/Sao_Paulo')::date";

  it("hoje é o dia de calendário de São Paulo, sem parâmetro do cliente", () => {
    const query = render(saoPauloTodaySql);
    expect(query.sql).toBe(TODAY);
    expect(query.params).toEqual([]);
  });

  it("exige início até hoje e fim nulo ou a partir de hoje (fim inclusivo), não só 'aberta'", () => {
    const { sql, params } = render(coordinatorAssignmentInForceToday("a"));
    expect(params).toEqual([]);
    const flat = sql.replace(/\s+/g, " ");
    expect(flat).toContain(`a.starts_on <= ${TODAY}`);
    expect(flat).toContain(`(a.ends_on is null or a.ends_on >= ${TODAY})`);
  });

  it("nega na sobreposição: nenhuma outra designação da empresa em vigor no mesmo dia", () => {
    const flat = render(coordinatorAssignmentInForceToday("a")).sql.replace(/\s+/g, " ");
    expect(flat).toContain(
      "not exists (select 1 from public.pcmso_coordinator_assignments concurrent",
    );
    expect(flat).toContain(
      "concurrent.org_id = a.org_id and concurrent.company_id = a.company_id",
    );
    expect(flat).toContain("concurrent.id <> a.id");
    expect(flat).toContain(`concurrent.starts_on <= ${TODAY}`);
    expect(flat).toContain(
      `(concurrent.ends_on is null or concurrent.ends_on >= ${TODAY})`,
    );
  });

  it("recusa alias que não seja identificador simples", () => {
    expect(() => coordinatorAssignmentInForceToday("a; drop table x")).toThrow(
      /Alias SQL inválido/,
    );
    expect(() => coordinatorAssignmentInForceToday("A")).toThrow(/Alias SQL inválido/);
  });
});
