/**
 * Regras risco → exame complementar com respaldo literal na NR-7 (Portaria MTP nº 567/2022;
 * texto oficial consultado em 01/11/2026). Só entram aqui agentes que a própria norma
 * nomeia; o resto fica para o médico coordenador (MED-15). Agentes identificados pelo
 * código da Tabela 24 do eSocial (S-1.3, NT 07/2026 rev. 20/10/2026), o mesmo gravado em
 * `risks.noxious_agent_code`. Procedimentos pela Tabela 27 (ver `procedure-catalog.ts`).
 *
 * A periodicidade é citada da norma, não calculada: o Quadro 1 do Anexo III depende de
 * medições (LSC × LEO) e do tempo de exposição, que o médico avalia.
 */
export const EXAM_RULES_VERSION =
  "NR-7 (Portaria MTP nº 567/2022) · eSocial S-1.3 NT 07/2026 rev. 20/10/2026 (Tabelas 24 e 27)";

/** Tabela 24 do eSocial: só os agentes usados pelas regras abaixo. */
export const NOXIOUS_AGENTS = {
  "02.01.001": "Ruído",
  "01.18.001": "Sílica livre",
  "01.02.001": "Asbestos (ou amianto)",
  "01.07.001": "Carvão mineral e seus derivados",
} as const;
export type RuleAgentCode = keyof typeof NOXIOUS_AGENTS;

export type ExamRule = {
  id: string;
  agentCodes: readonly RuleAgentCode[];
  procedureCode: string;
  reference: string;
  condition: string;
  periodicity: string;
  agentNotes?: Partial<Record<RuleAgentCode, string>>;
};

const MINERAL_DUSTS: readonly RuleAgentCode[] = ["01.18.001", "01.02.001", "01.07.001"];
const ASBESTOS_FOLLOW_UP =
  "Após o término do contrato com exposição ao asbesto, a organização deve disponibilizar exames periódicos por no mínimo 30 anos, sem custo ao trabalhador (Anexo III, item 2.17).";

export const EXAM_RULES: readonly ExamRule[] = [
  {
    id: "nr7-anexo-ii-audiometria",
    agentCodes: ["02.01.001"],
    procedureCode: "0281",
    reference: "NR-7, Anexo II, itens 2 e 4",
    condition:
      "Obrigatória para quem exerce ou exercerá atividade em ambiente com níveis de pressão sonora acima dos níveis de ação informados no PGR, independentemente do uso de protetor auditivo (item 2). Confira a avaliação do ruído no PGR.",
    periodicity:
      "No mínimo na admissão, anualmente e na demissão (item 4.1). Na demissão pode ser aceito exame realizado até 120 dias antes do fim do contrato (item 4.1.1). O intervalo pode ser reduzido a critério do médico responsável pelo PCMSO (item 4.2).",
  },
  {
    id: "nr7-anexo-iii-radiografia-torax",
    agentCodes: MINERAL_DUSTS,
    procedureCode: "1078",
    reference: "NR-7, Anexo III, item 1, a, e Quadro 1",
    condition:
      "Empregados expostos a poeira contendo sílica, asbesto ou carvão mineral, com leitura pelos critérios da OIT.",
    periodicity:
      "Conforme o Quadro 1 do Anexo III, que depende das medições quantitativas (LSC em relação ao LEO) e do tempo de exposição. Sem avaliação quantitativa: na admissão, a cada 2 anos até 15 anos de exposição e depois anualmente, e na demissão se o último exame tiver mais de 1 ano.",
    agentNotes: { "01.02.001": ASBESTOS_FOLLOW_UP },
  },
  {
    id: "nr7-anexo-iii-espirometria",
    agentCodes: MINERAL_DUSTS,
    procedureCode: "1057",
    reference: "NR-7, Anexo III, itens 1, b, e 3.1",
    condition:
      "Empregados expostos a poeiras minerais indicadas no inventário de riscos do PGR.",
    periodicity: "No exame admissional e a cada dois anos (item 3.1).",
    agentNotes: {
      "01.02.001":
        "Nos exames pós-demissionais de expostos ao asbesto, a espirometria segue a periodicidade do exame radiológico (Anexo III, item 3.5).",
    },
  },
];

export function rulesForAgent(agentCode: string): readonly ExamRule[] {
  return EXAM_RULES.filter((rule) =>
    (rule.agentCodes as readonly string[]).includes(agentCode),
  );
}

/** Exame clínico: obrigatório em todo exame ocupacional; não é sugestão de regra. */
export const CLINICAL_EXAM_NOTE = {
  reference: "NR-7, itens 7.5.6 e 7.5.7",
  text: "Todos os exames ocupacionais (admissional, periódico, retorno, mudança de risco e demissional) compreendem o exame clínico; os complementares abaixo são propostos a partir dos riscos.",
} as const;
