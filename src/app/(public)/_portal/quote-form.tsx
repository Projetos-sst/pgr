"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { submitPlatformLead } from "@/shared/server/actions/public-leads";
import {
  leadInputSchema,
  parseInterestParam,
  type LeadValues,
} from "@/shared/domains/platform/leads";

import { PORTAL_ROUTES } from "./routes";

/**
 * Formulário de orçamento — visual da prancha aprovada, **backend real**.
 *
 * O protótipo simula o envio com `setTimeout`. Aqui o envio chama a Server
 * Action `submitPlatformLead`, que revalida com Zod no servidor, aplica a
 * janela por IP hasheado e grava em `platform_leads` (INSERT sem SELECT).
 * Nada de confirmação falsa: a tela de sucesso só aparece com `ok` do servidor.
 *
 * Divergência intencional registrada em `PORTAL-REVIEW.md`: o consentimento do
 * design aponta para `#politica-de-privacidade`, página que não existe. Em vez
 * de publicar um link morto ou inventar texto jurídico, o rótulo descreve o uso
 * real dos dados. O aceite continua obrigatório e é validado no servidor; o
 * instante do consentimento é o `created_at` do registro.
 */
type Campo = "nome" | "empresa" | "email" | "tel" | "area" | "lgpd";

const AREAS = [
  {
    id: "a-seg",
    valor: "seguranca",
    titulo: "Segurança do Trabalho",
    apoio: "PGR e módulos de segurança",
    icone: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />,
  },
  {
    id: "a-med",
    valor: "medicina",
    titulo: "Medicina do Trabalho",
    apoio: "ASO e saúde ocupacional",
    icone: (
      <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5.2 8.8 11.4 8.8 11.4s8.8-6.2 8.8-11.4z" />
    ),
  },
  {
    id: "a-amb",
    valor: "ambas",
    titulo: "Ambas",
    apoio: "Segurança e Medicina",
    icone: null,
  },
] as const;

const MAX_MENSAGEM = 500;

/** Mensagem de erro de campo, no padrão `.err` do design. */
function Erro({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return <span id={id} />;
  return (
    <span className="err" id={id}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flex: "0 0 auto", marginTop: "1px" }}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4.5M12 16h.01" />
      </svg>
      {texto}
    </span>
  );
}

export function QuoteForm({ interesseInicial }: { interesseInicial: string | null }) {
  const [v, setV] = useState({
    nome: "",
    empresa: "",
    email: "",
    tel: "",
    area:
      interesseInicial && parseInterestParam(interesseInicial)
        ? (AREAS.find(
            (a) => parseInterestParam(a.valor) === parseInterestParam(interesseInicial),
          )?.valor ?? "")
        : "",
    msg: "",
    lgpd: false,
  });
  const [tried, setTried] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendente, startTransition] = useTransition();

  const set = (k: keyof typeof v, valor: string | boolean) =>
    setV((atual) => ({ ...atual, [k]: valor }));

  /** Mesmas regras do design, alinhadas ao schema que o servidor aplica. */
  function validar(): Partial<Record<Campo, string>> {
    const e: Partial<Record<Campo, string>> = {};
    if (v.nome.trim().length < 3) e.nome = "Informe seu nome.";
    if (!v.empresa.trim()) e.empresa = "Informe o nome da empresa.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) {
      e.email = v.email.trim()
        ? "Informe um e-mail válido, por exemplo nome@empresa.com.br."
        : "Informe seu e-mail.";
    }
    if (v.tel.replace(/\D/g, "").length < 10) e.tel = "Informe um telefone com DDD.";
    if (!v.area) e.area = "Escolha a área de interesse.";
    if (!v.lgpd) e.lgpd = "É necessário concordar para enviar a solicitação.";
    return e;
  }

  const erros = tried ? validar() : {};
  const totalErros = Object.keys(erros).length;

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErroEnvio(null);
    setTried(true);
    if (Object.keys(validar()).length > 0) return;

    const interest = parseInterestParam(v.area) as LeadValues["interest"];
    const parsed = leadInputSchema.safeParse({
      name: v.nome,
      company: v.empresa,
      email: v.email,
      phone: v.tel,
      interest,
      message: v.msg,
      source: "quote" as const,
    });
    if (!parsed.success) {
      setErroEnvio("Revise os dados informados e tente novamente.");
      return;
    }

    startTransition(async () => {
      const r = await submitPlatformLead(parsed.data);
      if (r.ok) {
        setEnviado(true);
        return;
      }
      setErroEnvio(r.error.message);
    });
  }

  if (enviado) {
    return (
      <div
        role="status"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "16px",
            background: "rgb(221, 245, 236)",
            color: "rgb(15, 122, 85)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Solicitação enviada
        </h2>
        <p style={{ fontSize: "16px", lineHeight: 1.6, color: "rgb(74, 77, 90)" }}>
          Recebemos seus dados. Nossa equipe retorna pelo e-mail ou telefone informado.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "6px" }}>
          <Link className="btn btn-primary" href={PORTAL_ROUTES.home}>
            Voltar ao início
          </Link>
          <Link className="btn btn-secondary" href={PORTAL_ROUTES.seguranca}>
            Conhecer a plataforma
          </Link>
        </div>
      </div>
    );
  }

  const campoProps = (campo: Campo, id: string) => ({
    id,
    className: erros[campo] ? "field is-error" : "field",
    "aria-required": true as const,
    "aria-invalid": erros[campo] ? true : false,
    "aria-describedby": `e-${campo}`,
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="form-title"
      style={{ display: "flex", flexDirection: "column", gap: "22px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h2
          id="form-title"
          style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          Seus dados
        </h2>
        <span style={{ fontSize: "13px", color: "rgb(86, 89, 102)" }}>
          <span className="req" aria-hidden="true">
            *
          </span>{" "}
          Campos obrigatórios
        </span>
      </div>

      {tried && totalErros > 0 ? (
        <div role="alert" className="form-alert">
          {totalErros === 1
            ? "1 campo precisa de atenção."
            : `${totalErros} campos precisam de atenção.`}
        </div>
      ) : null}
      {erroEnvio ? (
        <div role="alert" className="form-alert">
          {erroEnvio}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="lbl" htmlFor="f-nome">
            Nome{" "}
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            {...campoProps("nome", "f-nome")}
            type="text"
            name="nome"
            autoComplete="name"
            placeholder="Seu nome completo"
            value={v.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
          <Erro id="e-nome" texto={erros.nome} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="lbl" htmlFor="f-empresa">
            Empresa{" "}
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            {...campoProps("empresa", "f-empresa")}
            type="text"
            name="empresa"
            autoComplete="organization"
            placeholder="Nome da empresa"
            value={v.empresa}
            onChange={(e) => set("empresa", e.target.value)}
          />
          <Erro id="e-empresa" texto={erros.empresa} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="lbl" htmlFor="f-email">
            E-mail{" "}
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            {...campoProps("email", "f-email")}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@empresa.com.br"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <Erro id="e-email" texto={erros.email} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="lbl" htmlFor="f-tel">
            Telefone / WhatsApp{" "}
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            {...campoProps("tel", "f-tel")}
            type="tel"
            name="telefone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={v.tel}
            onChange={(e) => set("tel", e.target.value)}
          />
          <Erro id="e-tel" texto={erros.tel} />
        </div>
      </div>

      <fieldset
        aria-describedby="e-area"
        style={{
          border: "0px",
          margin: "0px",
          padding: "0px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <legend className="lbl" style={{ padding: "0px", marginBottom: "4px" }}>
          Área de interesse{" "}
          <span className="req" aria-hidden="true">
            *
          </span>
        </legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
            gap: "12px",
          }}
        >
          {AREAS.map((a) => {
            const on = v.area === a.valor;
            return (
              <label
                key={a.id}
                className={`opt${on ? "is-on" : ""}${erros.area ? "is-error" : ""}`}
                htmlFor={a.id}
              >
                <input
                  className="sr"
                  type="radio"
                  id={a.id}
                  name="area"
                  value={a.valor}
                  checked={on}
                  onChange={() => set("area", a.valor)}
                />
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "9px",
                      background:
                        a.valor === "medicina"
                          ? "rgb(227, 246, 242)"
                          : "rgb(238, 239, 254)",
                      color:
                        a.valor === "medicina" ? "rgb(14, 147, 132)" : "rgb(91, 99, 245)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {a.icone ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {a.icone}
                      </svg>
                    ) : (
                      <span style={{ display: "inline-flex", gap: "3px" }}>
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "rgb(91, 99, 245)",
                          }}
                        />
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "rgb(20, 184, 166)",
                          }}
                        />
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: on
                        ? "2px solid rgb(91, 99, 245)"
                        : "2px solid rgb(189, 187, 180)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: on ? "rgb(91, 99, 245)" : "transparent",
                      }}
                    />
                  </span>
                </span>
                <span style={{ fontWeight: 800, fontSize: "15px", marginTop: "6px" }}>
                  {a.titulo}
                </span>
                <span style={{ fontSize: "13px", color: "rgb(86, 89, 102)" }}>
                  {a.apoio}
                </span>
              </label>
            );
          })}
        </div>
        <Erro id="e-area" texto={erros.area} />
      </fieldset>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <label className="lbl" htmlFor="f-msg">
            Mensagem{" "}
            <span style={{ fontWeight: 500, color: "rgb(86, 89, 102)" }}>(opcional)</span>
          </label>
          <span
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
              fontSize: "12px",
              color: "rgb(86, 89, 102)",
            }}
          >
            {v.msg.length}/{MAX_MENSAGEM}
          </span>
        </div>
        <textarea
          id="f-msg"
          className="field"
          name="mensagem"
          maxLength={MAX_MENSAGEM}
          placeholder="Conte brevemente sobre sua empresa ou o que procura."
          value={v.msg}
          onChange={(e) => set("msg", e.target.value)}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "11px", alignItems: "flex-start" }}>
          <input
            id="f-lgpd"
            className="check"
            type="checkbox"
            aria-required="true"
            aria-invalid={erros.lgpd ? true : false}
            aria-describedby="e-lgpd"
            checked={v.lgpd}
            onChange={(e) => set("lgpd", e.target.checked)}
          />
          <label
            htmlFor="f-lgpd"
            style={{ fontSize: "14.5px", lineHeight: 1.55, color: "rgb(74, 77, 90)" }}
          >
            Autorizo o uso dos meus dados de contato para responder a esta solicitação.{" "}
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
        </div>
        <Erro id="e-lgpd" texto={erros.lgpd} />
      </div>

      <div>
        <button className="btn btn-primary" type="submit" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar solicitação"}
        </button>
      </div>
    </form>
  );
}
