/**
 * Contratos internos da camada de integrações. Providers traduzem qualquer falha
 * (rede, timeout, payload inesperado, não encontrado) num resultado fechado — o
 * chamador nunca lida com exceção nem com o formato bruto da API externa.
 */

export type ProviderFailureReason =
  | "not_found"
  | "timeout"
  | "upstream_error"
  | "invalid_payload";

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ProviderFailureReason };

/** Endereço retornado pelo ViaCEP (sem número — o usuário preenche). */
export type CepAddress = {
  zipCode: string;
  street: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

/** Endereço completo dentro do cadastro de empresa (BrasilAPI traz número). */
export type CnpjAddress = CepAddress & { number: string };

export type CnpjCompany = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  mainActivity: string;
  situacao: string;
  address: CnpjAddress;
};
