import type { Metadata } from "next";
import Link from "next/link";

import { AI_REVIEW_WARNING } from "@/shared/domains/platform/ai-review";

export const metadata: Metadata = {
  title: "Termos de uso — PGR-e",
  description:
    "Regras de uso da plataforma pgr-e, incluindo o uso de inteligência artificial.",
  alternates: { canonical: "/termos" },
};

const LAST_UPDATED = "20/11/2026";

const SECTIONS = [
  {
    id: "objeto",
    title: "Objeto",
    paragraphs: [
      "Estes termos explicam as regras de uso da plataforma pgr-e, um sistema para organizar a gestão de Saúde e Segurança do Trabalho: cadastros, riscos, programas, exames, treinamentos e documentos.",
      "Ao criar uma conta ou usar a plataforma, você concorda com estes termos.",
    ],
  },
  {
    id: "conta-e-acesso",
    title: "Conta e acesso",
    paragraphs: [
      "Cada pessoa usa a própria conta. Você é responsável por manter sua senha em segredo e por tudo que for feito com o seu acesso.",
      "Quem administra a organização decide quem entra na equipe e o que cada pessoa pode ver e fazer. Se notar um acesso que você não reconhece, avise o administrador da sua organização.",
    ],
  },
  {
    id: "responsabilidade-pelo-conteudo",
    title: "Responsabilidade pelo conteúdo",
    paragraphs: [
      "As informações cadastradas na plataforma são de responsabilidade de quem as inseriu e da organização usuária. A plataforma pgr-e oferece a ferramenta, mas não confere os dados informados.",
      "Documentos gerados pela plataforma são modelos preenchidos com os dados cadastrados. Antes de usar, assinar ou entregar um documento, confira o conteúdo.",
    ],
  },
  {
    id: "uso-de-inteligencia-artificial",
    title: "Uso de inteligência artificial",
    paragraphs: [
      "A plataforma oferece a IA pgr-e, que preenche campos automaticamente a partir dos dados já cadastrados. O conteúdo preenchido é uma sugestão inicial e nunca é salvo sem a sua confirmação.",
      `${AI_REVIEW_WARNING} Você deve revisar cada campo antes de salvar e corrigir o que não estiver de acordo com a realidade da empresa.`,
      "A plataforma pgr-e não se responsabiliza pelo conteúdo gerado pela IA e aceito por você. Ao confirmar, o conteúdo passa a ser seu, como se você mesmo o tivesse escrito.",
      "A responsabilidade técnica pelos documentos de PGR, PCMSO e ASO continua sendo do profissional habilitado que os assina. A IA não substitui a análise desse profissional.",
    ],
  },
  {
    id: "dados",
    title: "Dados",
    paragraphs: [
      "Os dados de cada organização ficam separados dos dados das outras organizações e só são acessados por quem tem permissão.",
      "Para preencher campos, a IA pgr-e recebe apenas as informações necessárias para aquela tarefa. Dados usados pela IA não são publicados nem compartilhados com outras organizações.",
    ],
  },
  {
    id: "alteracoes-dos-termos",
    title: "Alterações dos termos",
    paragraphs: [
      "Estes termos podem mudar para acompanhar novas funções da plataforma ou mudanças na lei. A data da última atualização fica sempre no topo desta página.",
      "Se você continuar usando a plataforma depois de uma mudança, entende-se que concorda com a nova versão.",
    ],
  },
];

export default function TermosPage() {
  return (
    <div
      style={{
        maxWidth: "820px",
        margin: "0px auto",
        padding: "28px 24px clamp(56px, 7vw, 96px)",
      }}
    >
      <nav
        aria-label="Trilha de navegação"
        style={{ marginBottom: "clamp(24px, 4vw, 48px)" }}
      >
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            margin: "0px",
            padding: "0px",
            listStyle: "none",
            fontSize: "13.5px",
            color: "rgb(86, 89, 102)",
          }}
        >
          <li>
            <Link
              href="/"
              style={{
                color: "rgb(86, 89, 102)",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "rgb(22, 23, 29)", fontWeight: "700" }}>
            Termos de uso
          </li>
        </ol>
      </nav>

      <header style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <span className="mono" style={{ color: "rgb(74, 81, 224)" }}>
          Termos de uso
        </span>
        <h1
          style={{
            fontSize: "clamp(34px, 4vw, 52px)",
            lineHeight: "1.05",
            letterSpacing: "-0.04em",
            fontWeight: "800",
            textWrap: "balance",
          }}
        >
          Termos de uso da plataforma pgr-e
        </h1>
        <p style={{ fontSize: "14.5px", color: "rgb(86, 89, 102)" }}>
          Última atualização: {LAST_UPDATED}
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "36px",
          marginTop: "clamp(32px, 5vw, 56px)",
        }}
      >
        {SECTIONS.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-titulo`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              paddingTop: "28px",
              borderTop: "1px solid rgb(225, 223, 218)",
            }}
          >
            <h2
              id={`${section.id}-titulo`}
              style={{
                fontSize: "22px",
                fontWeight: "800",
                letterSpacing: "-0.02em",
                color: "rgb(22, 23, 29)",
              }}
            >
              <span className="mono" style={{ color: "rgb(74, 81, 224)" }} aria-hidden>
                {String(index + 1).padStart(2, "0")}{" "}
              </span>
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                style={{ fontSize: "16px", lineHeight: "1.7", color: "rgb(74, 77, 90)" }}
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
