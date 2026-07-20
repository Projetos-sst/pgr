import { ErrorState } from "./_components/error-state";

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      eyebrow="Navegação"
      title="Página não encontrada"
      description="O endereço não existe ou foi movido para outro lugar."
      actions={[
        { label: "Abrir o painel", href: "/dashboard" },
        { label: "Página inicial", href: "/", variant: "quiet" },
      ]}
    />
  );
}
