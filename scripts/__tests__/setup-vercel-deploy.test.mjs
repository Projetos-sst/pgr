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

function fakeGitHub({
  existing = false,
  repo = "Projetos-sst/pgr",
  confirm = true,
} = {}) {
  const calls = [];
  const run = (args, input) => {
    calls.push({ args, input });
    if (args[0] === "repo") return repo;
    if (args[0] === "api" && args[1].endsWith("/environments")) {
      return JSON.stringify({ environments: existing ? [{ name: "develop" }] : [] });
    }
    if (args[0] === "secret" && args[1] === "list") {
      return JSON.stringify(
        confirm
          ? ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"].map((name) => ({
              name,
            }))
          : [],
      );
    }
    if (args[0] === "variable" && args[1] === "list") {
      return JSON.stringify([{ name: "VERCEL_TARGET", value: "production" }]);
    }
    return "";
  };
  return { calls, run };
}

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

test("credenciais vão por stdin ao environment correto e não disparam deploy por padrão", () => {
  const github = fakeGitHub();
  const values = readConfiguration(example);
  configureDeployment(values, github.run);
  const secretWrites = github.calls.filter(
    ({ args }) => args[0] === "secret" && args[1] === "set",
  );
  assert.equal(secretWrites.length, 3);
  for (const { args, input } of secretWrites) {
    assert.equal(input, values[args[2]]);
    assert.equal(args.at(-1), "develop");
    assert.ok(!args.includes(input));
  }
  const policy = github.calls.find(({ args }) => args.includes("POST"));
  assert.deepEqual(JSON.parse(policy.input), { name: "develop", type: "branch" });
  assert.ok(!github.calls.some(({ args }) => args[0] === "workflow"));
});

test("preserva as proteções de um environment existente", () => {
  const github = fakeGitHub({ existing: true });
  configureDeployment(readConfiguration(example), github.run);
  assert.ok(
    !github.calls.some(({ args }) => args.includes("PUT") || args.includes("POST")),
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

test("production cadastra credenciais isoladas e dispara apenas a main", () => {
  const github = fakeGitHub();
  configureDeployment(
    readConfiguration(
      example.replace("DEPLOY_ENVIRONMENT=develop", "DEPLOY_ENVIRONMENT=production"),
    ),
    github.run,
    true,
  );
  assert.equal(github.calls.at(-1).args.at(-1), "main");
  for (const { args } of github.calls.filter(
    ({ args }) => args[0] === "secret" && args[1] === "set",
  )) {
    assert.equal(args.at(-1), "production");
  }
});
