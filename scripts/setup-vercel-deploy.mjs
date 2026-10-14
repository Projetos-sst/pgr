#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = "Projetos-sst/pgr";
const secretNames = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"];

export function readConfiguration(contents) {
  const values = parseEnv(contents);
  for (const name of [...secretNames, "DEPLOY_ENVIRONMENT", "VERCEL_TARGET"]) {
    if (!values[name]?.trim()) throw new Error(`Preencha ${name} no .env.deploy.`);
    values[name] = values[name].trim();
  }
  if (!["develop", "production"].includes(values.DEPLOY_ENVIRONMENT)) {
    throw new Error("DEPLOY_ENVIRONMENT deve ser develop ou production.");
  }
  if (!["preview", "production"].includes(values.VERCEL_TARGET)) {
    throw new Error("VERCEL_TARGET deve ser preview ou production.");
  }
  if (
    values.DEPLOY_ENVIRONMENT === "production" &&
    values.VERCEL_TARGET !== "production"
  ) {
    throw new Error("A main deve usar VERCEL_TARGET=production.");
  }
  for (const name of secretNames) {
    if (/\s/.test(values[name]) || /[<>]/.test(values[name])) {
      throw new Error(`${name} contém espaços ou um placeholder; confira o valor.`);
    }
  }
  return values;
}

// Valores secretos entram somente por stdin; nunca em argumentos ou logs.
function gh(args, input) {
  const result = spawnSync("gh", args, {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Falha no GitHub CLI (${args.slice(0, 2).join(" ")}). Confira gh auth status e acesso administrativo ao PGR.`,
    );
  }
  return result.stdout.trim();
}

export function configureDeployment(values, run = gh, deploy = false) {
  const currentRepository = run([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);
  if (currentRepository.toLowerCase() !== repository.toLowerCase()) {
    throw new Error(`Execute no clone de ${repository}; nenhum secret foi alterado.`);
  }

  const environment = values.DEPLOY_ENVIRONMENT;
  const branch = environment === "production" ? "main" : "develop";
  const prefix = environment === "develop" ? "VERCEL_DEVELOP_" : "VERCEL_";
  const secretMappings = secretNames.map((name) => ({
    localName: name,
    githubName: prefix + name.slice("VERCEL_".length),
  }));
  for (const { localName, githubName } of secretMappings) {
    run(["secret", "set", githubName, "--repo", repository], values[localName]);
  }
  const targetName = prefix + "TARGET";
  run(["variable", "set", targetName, "--repo", repository], values.VERCEL_TARGET);

  const storedSecrets = JSON.parse(
    run(["secret", "list", "--repo", repository, "--json", "name"]),
  );
  if (
    secretMappings.some(
      ({ githubName }) => !storedSecrets.some((item) => item.name === githubName),
    )
  ) {
    throw new Error(
      "O GitHub não confirmou todos os secrets. Reexecute o setup; valores não serão exibidos.",
    );
  }
  const storedVariables = JSON.parse(
    run(["variable", "list", "--repo", repository, "--json", "name,value"]),
  );
  if (
    !storedVariables.some(
      (item) => item.name === targetName && item.value === values.VERCEL_TARGET,
    )
  ) {
    throw new Error("O GitHub não confirmou VERCEL_TARGET. Reexecute o setup.");
  }
  if (deploy) {
    run(["workflow", "run", "cd.yml", "--repo", repository, "--ref", branch]);
  }
  return { environment, branch, deployed: deploy };
}

function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--check", "--deploy"].includes(arg)) ||
    (args.includes("--check") && args.includes("--deploy"))
  ) {
    throw new Error("Uso: npm run deploy:setup [-- --check | -- --deploy]");
  }
  const envFile = resolve(repoRoot, ".env.deploy");
  let contents;
  try {
    contents = readFileSync(envFile, "utf8");
  } catch {
    throw new Error(
      "Crie .env.deploy a partir de .env.deploy.example e preencha as credenciais do PGR.",
    );
  }
  chmodSync(envFile, 0o600);
  const values = readConfiguration(contents);
  if (args.includes("--check")) {
    console.log(
      "Formato do .env.deploy válido. Nenhuma chamada ao GitHub ou à Vercel foi feita.",
    );
    return;
  }
  const result = configureDeployment(values, gh, args.includes("--deploy"));
  console.log(`Configuração confirmada em ${repository} / ${result.environment}.`);
  console.log(
    result.deployed
      ? `CD solicitado para ${result.branch}. Acompanhe no GitHub Actions.`
      : "Após integrar cd.yml, cada merge publica automaticamente. Use --deploy para disparar agora.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
