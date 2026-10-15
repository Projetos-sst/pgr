/**
 * Lógica pura dos formulários multi-step. Fica fora do componente para poder
 * ser coberta por teste unitário — o `FormSteps` só desenha o resultado.
 */

/**
 * Índices das etapas que contêm ao menos um campo com erro de validação.
 *
 * Num formulário em etapas o erro do servidor pode cair numa etapa que não
 * está visível; sem esse mapeamento o usuário veria o salvamento falhar sem
 * nenhuma pista de onde.
 *
 * @param stepFields campos de cada etapa, na ordem em que aparecem
 * @param errors erros por nome de campo, como devolvidos pela Server Action
 */
export function stepsWithError(
  stepFields: readonly (readonly string[])[],
  errors: Record<string, string>,
): number[] {
  return stepFields.flatMap((fields, index) =>
    fields.some((field) => errors[field]) ? [index] : [],
  );
}
