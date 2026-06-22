/**
 * Cookie httpOnly que fixa o tenant ativo entre as orgs do usuário. É a fonte de
 * verdade da seleção (escrito só pela Server Action de troca, validado contra as
 * memberships em `selectActiveTenant`). Não deriva da org ativa do Clerk — Modelo
 * B / 005: free pode ter org pessoal sem Clerk + colaborações com Clerk.
 */
export const ACTIVE_ORG_COOKIE = "tenant_active_org";
