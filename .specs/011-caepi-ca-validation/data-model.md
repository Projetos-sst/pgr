# Data Model — Validação/consulta de CA no CAEPI/MTE (fatia 011)

**Input**: [spec.md](./spec.md) (Key Entities, FR-020..024) · [research.md](./research.md)
(R5/R6/R9/R10) · mapa D8 do `docs/briefings/caepi-cron-brainstorming.md` §5.

## 1. Tabela `caepi_certificates` (GLOBAL — exceção documentada ao Princípio I)

Espelho local da base pública do CAEPI/MTE. **Sem `org_id`, sem policy de RLS de tenant, sem
`withOrg`** — dado público, idêntico para todos os tenants (exceção justificada e contida; ver
Constitution Check no plan). Escrita exclusiva do job (conexão owner); `app_runtime` = SELECT-only.

Arquivo: `src/shared/db/schema/caepi-certificates.ts` (+ export em `schema/index.ts`).
Migration: `src/shared/db/migrations/0009_caepi_certificates.sql` (drizzle-kit + SQL custom).

| Coluna              | Tipo          | Constraints              | Descrição                                                                                           |
| ------------------- | ------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `ca`                | `text`        | **PRIMARY KEY**          | Nº do CA normalizado (só dígitos). Chave natural: alvo do upsert e da consulta (R10).               |
| `valid_until`       | `date`        | `NOT NULL`               | `DATA DE VALIDADE` convertida de `dd/mm/aaaa` → ISO. Linha sem data válida é descartada no parse.   |
| `situation`         | `text`        | `NOT NULL`               | `SITUACAO` crua do MTE (`VÁLIDO`, `VENCIDO`, …). Estado cadastral — **sem delete** (D7).            |
| `manufacturer_name` | `text`        | nullable                 | `RAZAO SOCIAL` — autofill do campo Fabricante.                                                      |
| `manufacturer_cnpj` | `text`        | nullable                 | `CNPJ` do fabricante (contexto).                                                                    |
| `equipment_name`    | `text`        | nullable                 | `EQUIPAMENTO` — contexto p/ o usuário confirmar o modelo.                                           |
| `description`       | `text`        | nullable                 | `DESCRICAO EQUIPAMENTO` (contexto).                                                                 |
| `nature`            | `text`        | nullable                 | `NATUREZA` (Nacional/Importado — contexto).                                                         |
| `norms`             | `text`        | nullable                 | `NORMA` — autofill do campo Norma.                                                                  |
| `synced_at`         | `timestamptz` | `NOT NULL`               | Timestamp da execução do job que gravou/atualizou a linha (frescor da base; um valor por run — R5). |
| `created_at`        | `timestamptz` | `NOT NULL DEFAULT now()` | Padrão do repo.                                                                                     |
| `updated_at`        | `timestamptz` | `NOT NULL DEFAULT now()` | Mantida pela trigger `set_updated_at` (SQL custom na migration).                                    |

**SQL custom na migration `0009`** (padrão `0001`/`0005`/`0007`):

- `GRANT SELECT ON public.caepi_certificates TO app_runtime;` — **e nada além de SELECT**
  (diferente do `GRANT SELECT, INSERT, UPDATE, DELETE` das tabelas tenant). Sem GRANT de escrita,
  o backstop da exceção é o próprio Postgres.
- `CREATE TRIGGER set_updated_at_caepi_certificates BEFORE UPDATE … EXECUTE FUNCTION
public.set_updated_at();`
- **RLS habilitado com policy única de leitura global** `caepi_certificates_global_read`
  (`FOR SELECT TO app_runtime USING (true)`), declarada no schema Drizzle (`pgPolicy` +
  `enableRLS`) — revisão da R10 após o bootstrap real: o banco de produção força RLS em toda
  tabela nova (event trigger `ensure_rls` do projeto) e, sem a policy, o `app_runtime` lia vazio.
  **Não é policy de tenant**; a escrita segue dupla-trancada (sem GRANT e sem policy de escrita).
  **Sem** revoke extra de `anon`/`authenticated` — a `0006` já revogou os privilégios default
  para tabelas futuras.

**Índices**: apenas o da PK (`ca`). Nenhuma outra query de leitura existe nesta fatia (YAGNI).

## 2. Mapa CSV → coluna (D8 — fechado)

CSV real (Spike 0): separador `;`, campos entre aspas `"` (escape `""`, com `;`/`\n` internos),
UTF-8 **com BOM**, **19 colunas**. Cabeçalho → destino:

| #   | Coluna no CSV              | Destino                          |
| --- | -------------------------- | -------------------------------- |
| 1   | `NR Registro CA`           | `ca` (normalizado: só dígitos)   |
| 2   | `DATA DE VALIDADE`         | `valid_until` (`dd/mm/aaaa`→ISO) |
| 3   | `SITUACAO`                 | `situation`                      |
| 4   | `NR DO PROCESSO`           | — ignorada (YAGNI)               |
| 5   | `CNPJ`                     | `manufacturer_cnpj`              |
| 6   | `RAZAO SOCIAL`             | `manufacturer_name`              |
| 7   | `NATUREZA`                 | `nature`                         |
| 8   | `EQUIPAMENTO`              | `equipment_name`                 |
| 9   | `DESCRICAO EQUIPAMENTO`    | `description`                    |
| 10  | `MARCA CA`                 | — ignorada                       |
| 11  | `REFERENCIA`               | — ignorada                       |
| 12  | `COR`                      | — ignorada                       |
| 13  | `APROVADO PARA LAUDO`      | — ignorada                       |
| 14  | `RESTRICAO LAUDO`          | — ignorada                       |
| 15  | `OBSERVACAO ANALISE LAUDO` | — ignorada                       |
| 16  | `CNPJ LABORATORIO`         | — ignorada                       |
| 17  | `RAZAO SOCIAL LABORATORIO` | — ignorada                       |
| 18  | `NR LAUDO`                 | — ignorada                       |
| 19  | `NORMA`                    | `norms`                          |

**Regras de descarte no parse** (linha inteira descartada, com log e contador — nunca aborta a
carga): `ca` vazio/não-numérico após normalização; `valid_until` ausente ou não conversível;
contagem de colunas incompatível; falha na validação Zod da linha.

**Agregação por `ca` dentro do arquivo**: se o CSV trouxer o mesmo `ca` mais de uma vez, vence a
**última** ocorrência (o upsert por chunk já produz esse efeito; documentado para o teste de
idempotência não tratar como bug).

## 3. Tipos de domínio (`src/shared/integrations/caepi/types.ts`)

```ts
/** Linha tipada que sai do parse (validada por Zod). */
export type CaepiParsedRow = {
  ca: string; // só dígitos, não vazio
  validUntil: string; // YYYY-MM-DD
  situation: string; // cru do MTE
  manufacturerName: string | null;
  manufacturerCnpj: string | null;
  equipmentName: string | null;
  description: string | null;
  nature: string | null;
  norms: string | null;
};

/** Contrato de saída da consulta — união fechada de 3 estados (FR-004). */
export type CaLookupResult =
  | {
      status: "valid";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | {
      status: "expired";
      ca: string;
      manufacturer: string;
      norm: string;
      validUntil: string;
      equipmentName?: string;
    }
  | { status: "not_found"; ca: string; baseUnsynced?: boolean };
```

Notas de mapeamento registro → `CaLookupResult` (serviço `lookup.ts`):

- `manufacturer` ← `manufacturer_name ?? ""`; `norm` ← `norms ?? ""` (contrato exige string;
  colunas anuláveis viram vazio — o form trata vazio como "não preencher").
- `equipmentName` ← `equipment_name ?? undefined` (opcional no contrato).
- `validUntil` ← `valid_until` em `YYYY-MM-DD` (a UI formata pt-BR).
- `baseUnsynced: true` só quando `not_found` **e** a tabela está vazia (`getByCa` devolve o sinal;
  a surface transforma no aviso "base CAEPI ainda não sincronizada" — FR-006).

## 4. Derivação de estado (função pura `validate-ca.ts` — R6)

```
validateCa(record, today: "YYYY-MM-DD") →
  "valid"    ⇔ normalize(situation) === "VALIDO" && record.validUntil >= today   (inclusivo)
  "expired"  ⇔ qualquer outra combinação (validade passada OU situação ≠ VALIDO)
not_found  ⇔ decidido antes, pela ausência do registro (getByCa → null)
```

- `today` derivado em produção no fuso `America/Sao_Paulo`; injetado nos testes (limite `== hoje`
  → `valid` é caso de teste obrigatório).
- `normalize(situation)` = uppercase + NFD sem acentos (`VÁLIDO` → `VALIDO`); situação
  desconhecida → `expired` (conservador — nunca selo verde indevido).

## 5. Sem transições de estado / sem relacionamentos

- A tabela **não tem FK** de entrada nem de saída (espelho autocontido). O consumo pelo
  `epi_catalog` é **cópia por valor** no formulário (snapshot ao salvar) — nenhuma referência
  física (Inv-5; modelo de EPI intacto).
- Não há máquina de estados persistida: `valid`/`expired` é **derivado na leitura** (R6);
  `situation` é atributo espelhado da fonte, atualizado in-place pelo upsert (sem histórico —
  Out of Scope).
