import {
  contractCompaniesProblem,
  contractInputSchema,
  contractSnapshot,
  customerInputSchema,
  customerUpdateSchema,
} from "@/shared/domains/commercial/contract";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const paths = (
  schema: {
    safeParse: (input: unknown) => { error?: { issues: { path: PropertyKey[] }[] } };
  },
  input: unknown,
) => schema.safeParse(input).error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("cadastro do cliente comercial", () => {
  it("consultoria informa razão social, documento e e-mail de cobrança", () => {
    expect(
      customerInputSchema.parse({
        kind: "office",
        legalName: " Consultoria Teste Ltda ",
        taxId: "11.222.333/0001-81",
        billingEmail: "Financeiro@Exemplo.test",
      }),
    ).toEqual({
      kind: "office",
      legalName: "Consultoria Teste Ltda",
      taxId: "11222333000181",
      billingEmail: "financeiro@exemplo.test",
    });
  });

  it("cliente direto aponta a empresa cadastrada e não informa a identidade por fora", () => {
    const direct = {
      kind: "company",
      companyId: COMPANY,
      billingEmail: "a@exemplo.test",
    };
    expect(customerInputSchema.parse(direct)).toEqual(direct);
    expect(paths(customerInputSchema, { ...direct, legalName: "Outra" })).toEqual([""]);
  });

  it("recusa documento com tamanho errado, e-mail inválido e tipo desconhecido", () => {
    const office = {
      kind: "office",
      legalName: "Consultoria",
      taxId: "123",
      billingEmail: "financeiro@exemplo.test",
    };
    expect(paths(customerInputSchema, office)).toEqual(["taxId"]);
    expect(
      paths(customerInputSchema, {
        ...office,
        taxId: "11222333000181",
        billingEmail: "x",
      }),
    ).toEqual(["billingEmail"]);
    expect(paths(customerInputSchema, { ...office, kind: "partner" })).toEqual(["kind"]);
  });

  it("a alteração aceita e-mail e situação, e nunca o tipo ou a empresa", () => {
    expect(
      customerUpdateSchema.parse({ billingEmail: "b@exemplo.test", status: "inactive" }),
    ).toEqual({ billingEmail: "b@exemplo.test", status: "inactive" });
    expect(
      paths(customerUpdateSchema, {
        billingEmail: "b@exemplo.test",
        status: "active",
        companyId: OTHER,
      }),
    ).toEqual([""]);
  });
});

describe("pedido de contratação", () => {
  const input = {
    customerId: CUSTOMER,
    offerVersionId: VERSION,
    companyIds: [COMPANY],
    termStart: "2026-11-13",
    termEnd: null,
  };

  it("aceita cliente, versão, empresas e vigência, sem preço vindo do cliente", () => {
    expect(contractInputSchema.parse(input)).toEqual(input);
    expect(paths(contractInputSchema, { ...input, unitAmountCents: 1 })).toEqual([""]);
  });

  it("recusa empresa repetida e vigência invertida", () => {
    expect(
      paths(contractInputSchema, { ...input, companyIds: [COMPANY, COMPANY] }),
    ).toEqual(["companyIds"]);
    expect(paths(contractInputSchema, { ...input, termEnd: "2026-11-12" })).toEqual([
      "termEnd",
    ]);
  });
});

describe("quem paga e quem usa", () => {
  const direct = { customerKind: "company", customerCompanyId: COMPANY } satisfies {
    customerKind: "company";
    customerCompanyId: string;
  };
  const office = { customerKind: "office", customerCompanyId: null } satisfies {
    customerKind: "office";
    customerCompanyId: null;
  };

  it("cliente direto usa só a própria empresa", () => {
    expect(
      contractCompaniesProblem({
        ...direct,
        offerScope: "company",
        companyIds: [COMPANY],
      }),
    ).toBeNull();
    expect(
      contractCompaniesProblem({ ...direct, offerScope: "company", companyIds: [OTHER] }),
    ).toMatch(/própria empresa/);
    expect(
      contractCompaniesProblem({
        ...direct,
        offerScope: "company",
        companyIds: [COMPANY, OTHER],
      }),
    ).toMatch(/própria empresa/);
  });

  it("consultoria paga por uma ou mais empresas e nunca por nenhuma", () => {
    expect(
      contractCompaniesProblem({
        ...office,
        offerScope: "company",
        companyIds: [COMPANY, OTHER],
      }),
    ).toBeNull();
    expect(
      contractCompaniesProblem({ ...office, offerScope: "company", companyIds: [] }),
    ).toMatch(/ao menos uma empresa/);
  });

  it("oferta por escritório é contratada pela consultoria e não lista empresas", () => {
    expect(
      contractCompaniesProblem({ ...office, offerScope: "organization", companyIds: [] }),
    ).toBeNull();
    expect(
      contractCompaniesProblem({
        ...office,
        offerScope: "organization",
        companyIds: [COMPANY],
      }),
    ).toMatch(/não lista empresas/);
    expect(
      contractCompaniesProblem({
        ...direct,
        offerScope: "organization",
        companyIds: [],
      }),
    ).toMatch(/escritório/);
  });
});

describe("registro imutável da contratação", () => {
  const offer = {
    id: VERSION,
    code: "ficticio-pgr-medicina",
    version: 2,
    name: "PGR e Medicina (catálogo fictício de teste)",
    scope: "company",
    currency: "BRL",
    billingPeriod: "monthly",
    quotas: [{ metric: "employees", limit: 111 }],
    fictitious: true,
    items: [
      { service: "pgr", label: "PGR", unit: "company", unitAmountCents: 11111 },
      { service: "medicine", label: "Medicina", unit: "company", unitAmountCents: 22222 },
    ],
  } satisfies Parameters<typeof contractSnapshot>[0]["offer"];
  const customer = {
    kind: "office",
    legalName: "Consultoria Teste Ltda",
    taxId: "11222333000181",
  } satisfies Parameters<typeof contractSnapshot>[0]["customer"];

  it("copia pagador, oferta, preço, itens e cotas do momento da contratação", () => {
    expect(contractSnapshot({ customer, offer })).toEqual({
      header: {
        offerVersionId: VERSION,
        customerKind: "office",
        customerLegalName: "Consultoria Teste Ltda",
        customerTaxId: "11222333000181",
        offerCode: "ficticio-pgr-medicina",
        offerVersion: 2,
        offerName: "PGR e Medicina (catálogo fictício de teste)",
        offerScope: "company",
        currency: "BRL",
        billingPeriod: "monthly",
        quotas: [{ metric: "employees", limit: 111 }],
        fictitious: true,
      },
      items: [
        {
          position: 1,
          service: "pgr",
          label: "PGR",
          unit: "company",
          unitAmountCents: 11111,
        },
        {
          position: 2,
          service: "medicine",
          label: "Medicina",
          unit: "company",
          unitAmountCents: 22222,
        },
      ],
    });
  });

  it("o registro não muda quando a oferta de origem muda depois", () => {
    const source = {
      ...offer,
      items: offer.items.map((item) => ({ ...item })),
      quotas: offer.quotas.map((quota) => ({ ...quota })),
    };
    const snapshot = contractSnapshot({ customer, offer: source });
    source.items[0].unitAmountCents = 99999;
    source.quotas[0].limit = 1;
    expect(snapshot.items[0].unitAmountCents).toBe(11111);
    expect(snapshot.header.quotas).toEqual([{ metric: "employees", limit: 111 }]);
  });
});
