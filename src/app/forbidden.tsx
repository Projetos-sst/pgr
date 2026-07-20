import { ErrorState } from "./_components/error-state";

export default function Forbidden() {
  return (
    <ErrorState
      code="403"
      eyebrow="Permissão"
      title="Você não tem permissão"
      description="Esta operação não está disponível para a organização ativa."
      actions={[{ label: "Voltar ao painel", href: "/dashboard" }]}
    />
  );
}
