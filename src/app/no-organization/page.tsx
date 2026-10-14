import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

import { ErrorState } from "../_components/error-state";
import { SignOutLink } from "./sign-out-link";

/**
 * Estado "autenticado, mas sem organização".
 *
 * Por que a rota vive FORA de `(protected)`: aquele grupo exige **tenant**, não
 * apenas sessão (`requireTenantContext` no layout). Mandar este caso para
 * `/sign-in` — como era feito — não resolve nada, porque o Clerk devolve quem já
 * tem sessão para a área autenticada e o layout barra de novo: laço de
 * redirecionamento. Aqui a exigência é só **autenticação**; o isolamento
 * multi-tenant continua intacto porque esta página não lê nenhum dado de tenant.
 *
 * Também não é uma rota pública: não está na lista do `proxy.ts`, então o Clerk
 * manda visitante anônimo para o login antes de chegar aqui (e o guard abaixo
 * repete a verificação, defesa em profundidade).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organização pendente · PGR-e",
  robots: { index: false, follow: false },
};

export default async function NoOrganizationPage() {
  let hasTenant = false;
  try {
    // O provisionamento da organização pessoal é auto-reparável e roda dentro
    // desta chamada: se o vínculo já existir (ou for criado agora), a pessoa não
    // fica presa nesta tela — é isto que faz "Tentar novamente" funcionar.
    await requireTenantContext();
    hasTenant = true;
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    // Falha de infraestrutura (banco fora, credencial inválida) NÃO é "sem
    // organização": continua subindo para o boundary de erro, com diagnóstico.
    if (!(error instanceof NoTenantContextError)) throw error;
  }

  if (hasTenant) redirect("/welcome");

  return (
    <ErrorState
      eyebrow="Organização"
      title="Sua conta ainda não está vinculada a uma organização"
      description="Você entrou com sucesso, mas nenhuma organização está associada a este acesso — por isso o painel não abre. Normalmente é temporário: tente de novo em alguns instantes. Se persistir, peça a quem administra a conta para incluir você em uma organização."
      actions={[{ label: "Tentar novamente", href: "/welcome" }]}
    >
      <SignOutLink />
    </ErrorState>
  );
}
