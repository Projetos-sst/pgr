export type DomainRole = "owner" | "collaborator" | "client";

const DOMAIN_ROLES = new Set<DomainRole>(["owner", "collaborator", "client"]);

const CLERK_ROLE_TO_DOMAIN: Record<string, DomainRole> = {
  "org:admin": "owner",
  "org:member": "collaborator",
  "org:client": "client",
};

/**
 * Papéis do Clerk (`org:admin`/`org:member`) chegam crus pelo webhook e ficam
 * armazenados assim em `org_memberships.role`; o tenant pessoal grava `owner`
 * direto. Normaliza para o vocabulário de domínio (`owner`/`collaborator`/
 * `client`) num único ponto — papel desconhecido cai em `client` (menor
 * privilégio). Módulo sem dependências (evita ciclo com
 * `db/repositories/org-memberships`, que também precisa normalizar).
 */
export function toDomainRole(role: string): DomainRole {
  if (DOMAIN_ROLES.has(role as DomainRole)) return role as DomainRole;
  return CLERK_ROLE_TO_DOMAIN[role] ?? "client";
}
