import "server-only";

import { isPgrEditLocked } from "@/shared/domains/pgr/pgr-lock";
import {
  derivePgrSignatureState,
  type PgrSignatureState,
} from "@/shared/domains/pgr/pgr-signature";
import { getPgrById } from "@/shared/db/repositories/pgr";
import { getLatestRequestByTarget } from "@/shared/db/repositories/signature-requests";
import { AlreadySignedError } from "@/shared/errors/already-signed-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

const TARGET_TYPE = "pgr" as const;

const LOCKED_MESSAGE =
  "PGR assinado ou publicado não pode ser alterado. Registre uma nova revisão do documento.";
const NOT_SIGNED_MESSAGE = "Só é possível publicar um PGR já assinado.";

type PgrLockState = {
  signatureState: PgrSignatureState;
  publishedAt: Date | null;
};

/**
 * Estado de trava do PGR no tenant. O estado de assinatura é derivado da última solicitação
 * (o `pgr` não tem coluna de status) e a publicação vem de `published_at`. Vale também como
 * guard de existência/isolamento: inexistente ou de outro escritório → `NOT_FOUND`.
 */
async function loadPgrLockState(tenantId: string, pgrId: string): Promise<PgrLockState> {
  const row = await getPgrById(tenantId, pgrId);
  if (!row) throw new NotFoundError();
  const latest = await getLatestRequestByTarget(tenantId, TARGET_TYPE, pgrId);
  return {
    signatureState: derivePgrSignatureState(latest),
    publishedAt: row.publishedAt,
  };
}

/**
 * Barra escrita em PGR assinado/publicado. Chamado por **toda** porta de escrita (Server Action
 * e Route Handler) — o `readOnly` da UI é conveniência, não enforcement: Server Actions e
 * `/api/v1` são invocáveis diretamente pelo cliente.
 */
export async function assertPgrEditable(tenantId: string, pgrId: string): Promise<void> {
  const state = await loadPgrLockState(tenantId, pgrId);
  if (isPgrEditLocked(state)) throw new AlreadySignedError(LOCKED_MESSAGE);
}

/**
 * Publicar é o ato de fechar o documento assinado — publicar sem assinatura produziria um PGR
 * travado que ninguém assinou. Idempotente por construção: republicar um PGR já publicado
 * continua válido (ele necessariamente está assinado) e `publishPgr` não sobrescreve a data.
 */
export async function assertPgrPublishable(
  tenantId: string,
  pgrId: string,
): Promise<void> {
  const { signatureState } = await loadPgrLockState(tenantId, pgrId);
  if (signatureState !== "signed") throw new ValidationError(NOT_SIGNED_MESSAGE);
}
