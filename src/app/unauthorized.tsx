import { ErrorState } from "./_components/error-state";

export default function Unauthorized() {
  return (
    <ErrorState
      code="401"
      eyebrow="Autenticação"
      title="Você precisa estar autenticado"
      description="Faça login para acessar esta página."
      actions={[{ label: "Entrar", href: "/sign-in" }]}
    />
  );
}
