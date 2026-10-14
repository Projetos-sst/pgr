import assert from "node:assert/strict";
import { test } from "node:test";
import { configureDeployment, readConfiguration } from "../setup-vercel-deploy.mjs";

const example = `
DEPLOY_ENVIRONMENT=develop
VERCEL_TOKEN=token-de-teste
VERCEL_ORG_ID=team_pgr_teste
VERCEL_PROJECT_ID=prj_pgr_teste
VERCEL_TARGET=production
`;

function fakeGitHub({ repo = "Projetos-sst/pgr", confirm = true } = {}) {
  const calls = [];
  const secrets = new Set();
  const variables = new Map();
  const run = (args, input) => {
    calls.push({ args, input });
    if (args[0] === "repo") return repo;
    if (args[0] === "secret" && args[1] === "set") secrets.add(args[2]);
    if (args[0] === "variable" && args[1] === "set") variables.set(args[2], input);
    if (args[0] === "secret" && args[1] === "list") {
      return JSON.stringify(confirm ? [...secrets].map((name) => ({ name })) : []);
    }
    if (args[0] === "variable" && args[1] === "list") {
      return JSON.stringify([...variables].map(([name, value]) => ({ name, value })));
    }
    return "";
  };
  return { calls, run };
}

const writes = (calls) => calls.filter(({ args }) => args[1] === "set");

test("recusa credenciais ausentes sem incluir os outros valores na mensagem", () => {
  assert.throws(
    () =>
      readConfiguration(
        example.replace("VERCEL_ORG_ID=team_pgr_teste", "VERCEL_ORG_ID="),
      ),
    /^Error: Preencha VERCEL_ORG_ID no .env.deploy\.$/,
  );
});

test("main não pode apontar para Preview", () => {
  assert.throws(
    () =>
      readConfiguration(
        example
          .replace("DEPLOY_ENVIRONMENT=develop", "DEPLOY_ENVIRONMENT=production")
          .replace("VERCEL_TARGET=production", "VERCEL_TARGET=preview"),
      ),
    /main deve usar/,
  );
});

test("credenciais vão por stdin ao repo correto sem depender de GitHub Environments", () => {
  const github = fakeGitHub();
  const values = readConfiguration(example);
  configureDeployment(values, github.run);
  const secretWrites = writes(github.calls).filter(({ args }) => args[0] === "secret");
  assert.deepEqual(
    secretWrites.map(({ args }) => args[2]),
    ["VERCEL_DEVELOP_TOKEN", "VERCEL_DEVELOP_ORG_ID", "VERCEL_DEVELOP_PROJECT_ID"],
  );
  for (const { args, input } of secretWrites) {
    assert.equal(input, values[args[2].replace("VERCEL_DEVELOP_", "VERCEL_")]);
    assert.equal(args.at(-1), "Projetos-sst/pgr");
    assert.ok(!args.includes(input));
    assert.ok(!args.includes("--env"));
  }
  assert.ok(
    !github.calls.some(({ args }) => args[0] === "api" || args[0] === "workflow"),
  );
});

test("configurar develop não altera os secrets de produção", () => {
  const github = fakeGitHub();
  configureDeployment(readConfiguration(example), github.run);
  assert.ok(
    writes(github.calls).every(({ args }) => args[2].startsWith("VERCEL_DEVELOP_")),
  );
});

test("não grava secrets em outro repositório", () => {
  const github = fakeGitHub({ repo: "Dougladmo/postify-frontend" });
  assert.throws(
    () => configureDeployment(readConfiguration(example), github.run),
    /nenhum secret foi alterado/,
  );
  assert.equal(github.calls.length, 1);
});

test("só dispara o CD quando solicitado e após confirmar a configuração", () => {
  const github = fakeGitHub();
  configureDeployment(readConfiguration(example), github.run, true);
  assert.deepEqual(github.calls.at(-1).args, [
    "workflow",
    "run",
    "cd.yml",
    "--repo",
    "Projetos-sst/pgr",
    "--ref",
    "develop",
  ]);
  const missing = fakeGitHub({ confirm: false });
  assert.throws(
    () => configureDeployment(readConfiguration(example), missing.run, true),
    /não confirmou todos os secrets/,
  );
  assert.ok(!missing.calls.some(({ args }) => args[0] === "workflow"));
});

test("production usa os nomes do Postify e dispara apenas a main", () => {
  const github = fakeGitHub();
  configureDeployment(
    readConfiguration(
      example.replace("DEPLOY_ENVIRONMENT=develop", "DEPLOY_ENVIRONMENT=production"),
    ),
    github.run,
    true,
  );
  assert.equal(github.calls.at(-1).args.at(-1), "main");
  assert.deepEqual(
    writes(github.calls).map(({ args }) => args[2]),
    ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID", "VERCEL_TARGET"],
  );
});
