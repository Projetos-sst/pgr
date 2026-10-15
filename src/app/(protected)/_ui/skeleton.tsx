/**
 * Bloco de esqueleto (placeholder de conteúdo que ainda vai chegar). Usado quando a
 * espera produz conteúdo **novo** — nunca por cima de conteúdo que o usuário já podia
 * ler. É decorativo: fica fora da árvore de acessibilidade (`aria-hidden`), e quem
 * anuncia o estado para leitores de tela é o container com `role="status"`.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-block block rounded-full bg-black/[0.07] ${className}`}
    />
  );
}
