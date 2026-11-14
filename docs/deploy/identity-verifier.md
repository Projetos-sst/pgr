# Verificação de identidade profissional: provisionamento do operador (NOB-158)

O acesso clínico só existe para profissional com identidade verificada por um **operador designado
da plataforma**, independente do escritório. Este documento descreve o provisionamento seguro. Ele
não designa ninguém: a nomeação dos operadores, o canal de conferência, a política de evidências e a
validade definitiva são decisões do Carlos e precisam estar aprovadas antes da produção.

Enquanto nada abaixo estiver feito, a verificação fica indisponível, e o acesso clínico de todos os
vínculos continua bloqueado. Isso é intencional (falha fechada).

## 1. Papel de banco

A migration `0071_professional_identity_verifications` cria o papel **`identity_verifier` (NOLOGIN)**
e dá a ele só o necessário:

- `SELECT` em `identity_verifiers`, pedidos, verificações, decisões, `medicos`, `org_memberships` e `orgs`;
- `INSERT` em `professional_identity_verifications` e `professional_identity_review_events`.

Ele não tem acesso a nenhuma tabela clínica (prontuário, exames, afastamentos). O `app_runtime` não é
membro desse papel e não tem escrita nas verificações nem leitura da designação.

## 2. Conta de login do operador (infraestrutura)

Feito pela infraestrutura (Douglas), por ambiente, com a conta administrativa do banco, **fora** do
app e das migrations:

```sql
-- Senha gerada e guardada no cofre de segredos; nunca em código ou em log.
CREATE ROLE identity_verifier_login LOGIN PASSWORD '<segredo>' IN ROLE identity_verifier;
```

Para usar o pooler (Supabase), siga o mesmo procedimento usado na criação do `app_runtime`. Configure no
projeto da Vercel, só no servidor:

- `IDENTITY_VERIFIER_DATABASE_URL`: URL dessa conta (nunca a de migrations nem a do `app_runtime`);
- `IDENTITY_CHALLENGE_SECRET`: segredo aleatório longo do desafio de controle da conta;
- `IDENTITY_VERIFICATION_VALIDITY_MONTHS`: validade em meses (1 a 12; padrão 12, decisão NOB-158). Valor maior é limitado a 12 pelo app, e o banco recusa mais de 12 meses (migration `0083`).

Nenhuma dessas variáveis é exposta ao navegador.

## 3. Designação de operadores

A designação fica em `identity_verifiers` e **não tem caminho pela aplicação**. Nem owner, nem master,
nem o próprio operador designam. Ela é feita com a conta administrativa do banco, depois da aprovação
formal do Carlos:

```sql
INSERT INTO public.identity_verifiers (user_id, designated_by)
VALUES ('<id Clerk do operador aprovado>', '<quem executa o provisionamento>');
-- Revogação (o histórico fica):
UPDATE public.identity_verifiers
   SET revoked_at = now(), revoked_by = '<quem executa>', revoke_reason = '<motivo>'
 WHERE user_id = '<id>' AND revoked_at IS NULL;
```

Além da designação, a tela `/admin-global/identity-verifications`, as Server Actions e as rotas REST `/api/v1/admin/identity-verifications(…)` exigem que o operador seja master pela sessão Clerk real. O bypass dev da REST não substitui essa sessão, e a conta do operador nunca vem do header `x-dev-user`.

## 4. Regras que o banco garante

- O operador não verifica a própria conta nem contas de escritórios dos quais é membro.
- A verificação exige pedido em aberto feito pela própria conta do profissional.
- O CRM/UF conferidos precisam ser iguais ao cadastro.
- O checklist precisa estar completo.
- Revogação, expiração ou mudança posterior de CRM/UF cortam o acesso clínico na hora.
- Cada conferência do código fica em `identity_challenge_attempts` (0072), só inclusão e sem o código.
  Só o operador grava e lê; o `app_runtime` não tem acesso.

## 4.1 Limites do código de controle da conta

A aplicação conta só os códigos errados e serializa as tentativas da mesma conta e do mesmo operador:

- **5 por pedido**, no total. Esgotado, o operador recusa o pedido e o profissional abre outro.
- **10 por conta do profissional em 24 h**, somando pedidos e operadores (força bruta distribuída).
- **10 por operador em 1 h**, somando todas as contas.

Com o limite esgotado, nem o código certo é conferido. Bloqueio repetido de operador ou de conta é sinal
de abuso e deve ser investigado (consulta somente leitura em `identity_challenge_attempts`).

## 5. Procedimento operacional (decisões A–E aprovadas em 03/11/2026)

1. O profissional pede a verificação em **Minha identidade profissional**.
2. O operador faz a conferência **presencial ou por vídeo ao vivo, sem gravação**:
   - documento oficial de identidade;
   - documento ou registro profissional;
   - situação do CRM/UF em fonte oficial;
   - correspondência entre pessoa, documentos e cadastro.
3. **Controle da conta:** o profissional lê ao operador o código de 6 dígitos exibido na sessão
   autenticada dele. O código muda a cada 5 minutos e vale no máximo ~10 minutos. O operador pede
   que o profissional recarregue a tela durante a chamada e leia o código atual.
4. O operador registra método, fonte consultada e uma referência de auditoria. Fotos ou documentos não
   são guardados na aplicação.

A conferência documental reduz, mas **não elimina**, o risco de fraude (por exemplo, documentos de
terceiros). A evolução prevista é o certificado ICP-Brasil (MED-12).

Validade de 12 meses (decisão D): a renovação é uma nova verificação. **Guarda das evidências
(decisão C):** só metadados (checklist, método, fonte e referência), sem documento bruto e sem
exclusão automática. O prazo de retenção depende de base jurídica escrita (LGPD e obrigações
aplicáveis) e não foi presumido.

### 5.1 Incidente de sessão ou de conta (risco residual aceito)

Um código copiado de uma sessão que depois foi revogada continua valendo até o fim da janela (no
máximo ~10 minutos). Mesmo assim, **não dá acesso a quem copiou**:

- a verificação fica gravada para a conta dona do pedido;
- todo acesso clínico exige, no momento do uso, uma sessão viva da própria conta e associação
  ativa ao escritório.

Se houver suspeita de sessão ou conta comprometida:

1. No Clerk: revogar as sessões da conta e exigir troca de senha (e MFA, se disponível).
2. Recusar os pedidos de verificação em aberto da conta
   (`POST /api/v1/admin/identity-verifications/requests/{id}/reject`, motivo "incidente de sessão").
3. Se uma verificação foi aprovada durante o incidente, revogá-la
   (`POST /api/v1/admin/identity-verifications/{id}/revoke`). O acesso clínico cai na hora.
4. Registrar o incidente e a data, sem dado clínico, e só abrir novo pedido depois de a conta estar
   sob controle do titular.

## 6. Liberação (expand/contract)

A 0071 já aplica a regra no banco. Na janela do deploy, e até haver verificação, todo acesso clínico
fica bloqueado: falha fechada, sem bypass. Ordem recomendada por ambiente:

1. rodar o inventário da NOB-159 (somente leitura);
2. provisionar a conta, o segredo e os operadores aprovados;
3. publicar;
4. conferir os profissionais;
5. validar o acesso clínico.
