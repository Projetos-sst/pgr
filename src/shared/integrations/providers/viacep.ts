import { z } from "zod";

import { normalizeCep } from "../validation";
import { fetchJsonWithTimeout } from "./http";
import type { CepAddress, ProviderResult } from "./types";

const VIACEP_BASE_URL = "https://viacep.com.br/ws";

// ViaCEP sinaliza CEP inexistente com `{ "erro": true }` (versões novas usam a
// string "true"); os demais campos podem faltar (CEP de grande usuário sem rua).
const viaCepSchema = z.object({
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  localidade: z.string().optional(),
  uf: z.string().optional(),
  erro: z.union([z.boolean(), z.string()]).optional(),
});

export async function fetchViaCep(rawCep: string): Promise<ProviderResult<CepAddress>> {
  const cep = normalizeCep(rawCep);
  const response = await fetchJsonWithTimeout(`${VIACEP_BASE_URL}/${cep}/json/`);
  if (!response.ok) return { ok: false, reason: response.reason };
  if (response.status === 400 || response.status === 404) {
    return { ok: false, reason: "not_found" };
  }
  if (response.status !== 200) return { ok: false, reason: "upstream_error" };

  const parsed = viaCepSchema.safeParse(response.body);
  if (!parsed.success) return { ok: false, reason: "invalid_payload" };

  const data = parsed.data;
  if (data.erro === true || data.erro === "true") {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    data: {
      zipCode: data.cep ? normalizeCep(data.cep) : cep,
      street: data.logradouro ?? "",
      complement: data.complemento ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    },
  };
}
