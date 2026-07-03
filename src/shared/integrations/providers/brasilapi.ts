import { z } from "zod";

import { normalizeCep, normalizeCnpj } from "../validation";
import { fetchJsonWithTimeout } from "./http";
import type { CnpjCompany, ProviderResult } from "./types";

const BRASILAPI_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1";

// BrasilAPI devolve 404 para CNPJ inexistente. `cnae_fiscal` vem numérico; campos
// de razão/fantasia/endereço podem faltar (MEI sem dados públicos completos).
const brasilApiCnpjSchema = z.object({
  cnpj: z.string().optional(),
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  cnae_fiscal: z.union([z.number(), z.string()]).optional(),
  cnae_fiscal_descricao: z.string().optional(),
  descricao_situacao_cadastral: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().optional(),
});

export async function fetchBrasilApiCnpj(
  rawCnpj: string,
): Promise<ProviderResult<CnpjCompany>> {
  const cnpj = normalizeCnpj(rawCnpj);
  const response = await fetchJsonWithTimeout(`${BRASILAPI_CNPJ_URL}/${cnpj}`);
  if (!response.ok) return { ok: false, reason: response.reason };
  if (response.status === 400 || response.status === 404) {
    return { ok: false, reason: "not_found" };
  }
  if (response.status !== 200) return { ok: false, reason: "upstream_error" };

  const parsed = brasilApiCnpjSchema.safeParse(response.body);
  if (!parsed.success) return { ok: false, reason: "invalid_payload" };

  const data = parsed.data;
  return {
    ok: true,
    data: {
      cnpj: data.cnpj ? normalizeCnpj(data.cnpj) : cnpj,
      razaoSocial: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia ?? "",
      cnae: data.cnae_fiscal != null ? String(data.cnae_fiscal) : "",
      mainActivity: data.cnae_fiscal_descricao ?? "",
      situacao: data.descricao_situacao_cadastral ?? "",
      address: {
        zipCode: data.cep ? normalizeCep(data.cep) : "",
        street: data.logradouro ?? "",
        number: data.numero ?? "",
        complement: data.complemento ?? "",
        district: data.bairro ?? "",
        city: data.municipio ?? "",
        state: data.uf ?? "",
      },
    },
  };
}
