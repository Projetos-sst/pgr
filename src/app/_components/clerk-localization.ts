import { ptBR } from "@clerk/localizations";

import { BRAND } from "@/app/(public)/_content/platform";

/**
 * Localização do Clerk em pt-BR com a marca correta.
 *
 * **Problema real observado:** a tela de login anunciava "para continuar em
 * sst-manager". Esse `sst-manager` é o *nome da aplicação no painel do Clerk*,
 * que o Clerk interpola em 18 strings do pt-BR pelo placeholder
 * `{{applicationName}}` — não é texto nosso, e por isso não estava em lugar
 * nenhum do repositório.
 *
 * **Correção definitiva:** renomear a aplicação no painel do Clerk para
 * `PGR-e`. É configuração externa, fora do alcance desta branch, e está
 * registrada como dependência em `PORTAL-AUDIT.md`.
 *
 * **Correção aqui:** substituir o placeholder pelo nome da marca na própria
 * camada de localização do Clerk — que é a API oficial para isso. Não é
 * manipulação de DOM nem CSS escondendo texto: é o mesmo mecanismo que já
 * traduz a interface. A troca é feita varrendo as strings em vez de listar as
 * 18 chaves à mão, para não envelhecer quando o Clerk adicionar outra.
 *
 * Quando o painel for renomeado, este módulo pode ser removido e o
 * `localization={ptBR}` volta a bastar — sem efeito visível para o usuário.
 */
const PLACEHOLDER = /\{\{applicationName\}\}/g;

type Localization = typeof ptBR;

function replaceBrand<T>(node: T): T {
  // `replace` direto (sem `test` antes): um regex global guarda `lastIndex`, e
  // `test` o deixaria avancado para a string seguinte.
  if (typeof node === "string") {
    return node.replace(PLACEHOLDER, BRAND.name) as unknown as T;
  }
  if (Array.isArray(node)) return node.map(replaceBrand) as unknown as T;
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) out[key] = replaceBrand(value);
    return out as T;
  }
  return node;
}

export const clerkLocalization: Localization = replaceBrand(ptBR);
