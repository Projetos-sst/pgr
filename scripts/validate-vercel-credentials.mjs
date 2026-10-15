export async function validateVercelCredentials(values, request = fetch) {
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(values.VERCEL_PROJECT_ID)}`,
  );
  url.searchParams.set("teamId", values.VERCEL_ORG_ID);
  let response;
  let project;
  try {
    response = await request(url, {
      headers: { Authorization: `Bearer ${values.VERCEL_TOKEN}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    project = await response.json();
  } catch {
    throw new Error(
      "Não foi possível consultar a Vercel. Confira a conexão e tente novamente.",
    );
  }
  if (!response.ok) {
    const reasons = {
      401: "Token da Vercel inválido ou expirado.",
      403: "Token sem acesso ao time/projeto informado.",
      404: "Projeto não encontrado nesse time ou não acessível com o token.",
      429: "Limite de consultas da Vercel atingido. Tente novamente mais tarde.",
    };
    throw new Error(
      reasons[response.status] ?? `A consulta à Vercel falhou (HTTP ${response.status}).`,
    );
  }
  if (
    project.id !== values.VERCEL_PROJECT_ID ||
    project.accountId !== values.VERCEL_ORG_ID
  ) {
    throw new Error("O ID do projeto e o ID do time não correspondem na Vercel.");
  }
  if (values.VERCEL_PROJECT_NAME && values.VERCEL_PROJECT_NAME !== project.name) {
    throw new Error("O projeto encontrado não corresponde a VERCEL_PROJECT_NAME.");
  }
  return {
    projectName: project.name,
    productionBranch: project.link?.productionBranch ?? null,
    linkedRepository:
      project.link?.org && project.link?.repo
        ? `${project.link.org}/${project.link.repo}`
        : null,
  };
}
