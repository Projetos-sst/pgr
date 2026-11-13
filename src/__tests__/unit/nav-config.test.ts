import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  allNavHrefs,
  groupHrefs,
  NAV,
  visibleNav,
} from "@/app/(protected)/_components/nav-config";

const PROTECTED_DIR = join(process.cwd(), "src", "app", "(protected)");

const SHARED_MASTER_DATA = [
  "/companies",
  "/work-units",
  "/job-roles",
  "/ges",
  "/employees",
  "/categories",
  "/vehicles",
  "/form-controls",
];

const SAFETY_ONLY = [
  "/service-orders",
  "/work-permits",
  "/epi-catalog",
  "/epi-stock",
  "/epi-returns",
  "/training-catalog",
  "/training-compliance",
  "/training-expiry",
  "/inspection-plans",
];

const SHORTCUTS_IN_BOTH_AREAS = ["/incidents", "/psychosocial/campaigns"];

describe("mapa de menus (NOB-172, SEG-06)", () => {
  it("leva cada item a uma página que existe", () => {
    const broken = allNavHrefs().filter(
      (href) => !existsSync(join(PROTECTED_DIR, ...href.split("/"), "page.tsx")),
    );

    expect(broken).toEqual([]);
  });

  it("mantém no Cadastro só os cadastros mestres compartilhados", () => {
    expect(groupHrefs("Cadastro")).toEqual(SHARED_MASTER_DATA);
  });

  it("trata OS, permissões de trabalho, EPI, treinamentos e planos de inspeção como Segurança", () => {
    const safety = groupHrefs("Gestão de Segurança");
    const health = groupHrefs("Medicina do Trabalho");

    expect(SAFETY_ONLY.filter((href) => !safety.includes(href))).toEqual([]);
    expect(SAFETY_ONLY.filter((href) => health.includes(href))).toEqual([]);
  });

  it("dá entrada a incidentes e psicossocial nas duas áreas", () => {
    const safety = groupHrefs("Gestão de Segurança");
    const health = groupHrefs("Medicina do Trabalho");

    expect(SHORTCUTS_IN_BOTH_AREAS.filter((href) => !safety.includes(href))).toEqual([]);
    expect(SHORTCUTS_IN_BOTH_AREAS.filter((href) => !health.includes(href))).toEqual([]);
  });

  it("só repete destino entre áreas nos atalhos previstos, nunca dentro do mesmo menu", () => {
    const groups = NAV.flatMap((entry) => (entry.kind === "group" ? [entry.label] : []));
    const repeatedInsideGroup = groups.filter((label) => {
      const hrefs = groupHrefs(label);
      return new Set(hrefs).size !== hrefs.length;
    });
    const hrefs = allNavHrefs();
    const repeatedAcrossGroups = [
      ...new Set(hrefs.filter((href, index) => hrefs.indexOf(href) !== index)),
    ];

    expect(repeatedInsideGroup).toEqual([]);
    expect(repeatedAcrossGroups).toEqual(SHORTCUTS_IN_BOTH_AREAS);
  });

  it("expõe a emissão de relatórios em PDF no menu", () => {
    expect(groupHrefs("Módulos")).toContain("/reports");
  });

  it("dá entrada à política de guarda e descarte junto do GED", () => {
    expect(groupHrefs("Qualidade")).toEqual(["/documents", "/retention"]);
  });

  it("mostra o menu inteiro para quem tem as duas áreas (NOB-175)", () => {
    expect(visibleNav(["safety", "health"])).toEqual(NAV);
  });

  it("esconde Gestão de Segurança e o PGR de quem só tem a área de Saúde", () => {
    const nav = visibleNav(["health"]);
    const hrefs = allNavHrefs(nav);

    expect(nav.map((entry) => entry.label)).not.toContain("Gestão de Segurança");
    expect(nav.map((entry) => entry.label)).toContain("Medicina do Trabalho");
    expect(hrefs).toEqual(expect.arrayContaining([...SHORTCUTS_IN_BOTH_AREAS]));
    expect(hrefs).toEqual(expect.arrayContaining(SHARED_MASTER_DATA));
    expect(hrefs.filter((href) => ["/pgr", "/risks"].includes(href))).toEqual([]);
    expect(SAFETY_ONLY.filter((href) => hrefs.includes(href))).toEqual([]);
  });

  it("esconde Medicina do Trabalho de quem só tem a área de Segurança", () => {
    const nav = visibleNav(["safety"]);
    const hrefs = allNavHrefs(nav);

    expect(nav.map((entry) => entry.label)).not.toContain("Medicina do Trabalho");
    expect(hrefs).toEqual(
      expect.arrayContaining(["/pgr", "/risks", ...SHORTCUTS_IN_BOTH_AREAS]),
    );
    expect(
      hrefs.filter((href) => ["/health-exams", "/medicos", "/medicine"].includes(href)),
    ).toEqual([]);
  });

  it("sem área nenhuma deixa só o que não pertence a uma área", () => {
    expect(visibleNav([]).map((entry) => entry.label)).toEqual([
      "Dashboard",
      "Módulos",
      "Cadastro",
      "Qualidade",
    ]);
    expect(allNavHrefs(visibleNav([]))).not.toContain("/pgr");
  });
});
