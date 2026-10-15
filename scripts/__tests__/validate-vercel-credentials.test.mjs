import assert from "node:assert/strict";
import { test } from "node:test";
import { validateVercelCredentials } from "../validate-vercel-credentials.mjs";

const values = {
  VERCEL_TOKEN: "token-teste-privado",
  VERCEL_ORG_ID: "team_pgr",
  VERCEL_PROJECT_ID: "prj_pgr",
  VERCEL_PROJECT_NAME: "develop-pgr-e",
};
const project = {
  id: "prj_pgr",
  accountId: "team_pgr",
  name: "develop-pgr-e",
  link: { org: "Projetos-sst", repo: "pgr", productionBranch: "develop" },
};
const reply =
  (data, status = 200) =>
  async () =>
    new Response(JSON.stringify(data), { status });

test("valida token, time e projeto por GET e retorna apenas metadados", async () => {
  const result = await validateVercelCredentials(values, async (url, options) => {
    assert.equal(url.hostname, "api.vercel.com");
    assert.equal(url.pathname, "/v9/projects/prj_pgr");
    assert.equal(url.searchParams.get("teamId"), "team_pgr");
    assert.equal(options.headers.Authorization, "Bearer " + values.VERCEL_TOKEN);
    assert.equal(options.redirect, "error");
    assert.equal(options.method, undefined);
    return new Response(JSON.stringify(project));
  });
  assert.deepEqual(result, {
    projectName: "develop-pgr-e",
    productionBranch: "develop",
    linkedRepository: "Projetos-sst/pgr",
  });
  assert.ok(!JSON.stringify(result).includes(values.VERCEL_TOKEN));
});

for (const [status, message] of [
  [401, /inválido ou expirado/],
  [403, /sem acesso/],
  [404, /não encontrado/],
  [429, /Limite de consultas/],
]) {
  test(`HTTP ${status} bloqueia o setup sem expor a resposta da API`, async () => {
    await assert.rejects(
      validateVercelCredentials(
        values,
        reply({ error: { message: values.VERCEL_TOKEN } }, status),
      ),
      (error) => {
        assert.match(error.message, message);
        assert.ok(!error.message.includes(values.VERCEL_TOKEN));
        return true;
      },
    );
  });
}

test("recusa IDs que não correspondem ao mesmo projeto/time", async () => {
  await assert.rejects(
    validateVercelCredentials(values, reply({ ...project, accountId: "team_outro" })),
    /não correspondem/,
  );
  await assert.rejects(
    validateVercelCredentials(values, reply({ ...project, id: "prj_outro" })),
    /não correspondem/,
  );
});

test("recusa nome esperado diferente, mesmo com credenciais válidas", async () => {
  await assert.rejects(
    validateVercelCredentials(values, reply({ ...project, name: "outro-projeto" })),
    /não corresponde/,
  );
});

test("falha de rede não expõe token contido no erro original", async () => {
  await assert.rejects(
    validateVercelCredentials(values, async () => {
      throw new Error(values.VERCEL_TOKEN);
    }),
    (error) => {
      assert.match(error.message, /Não foi possível consultar/);
      assert.ok(!error.message.includes(values.VERCEL_TOKEN));
      return true;
    },
  );
});
