import { fireEvent, render, screen, within } from "@testing-library/react";

import { groupHrefs } from "@/app/(protected)/_components/nav-config";
import { NavMenu } from "@/app/(protected)/_components/nav-menu";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

function hrefsIn(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "");
}

describe("NavMenu (NOB-172)", () => {
  it("no desktop, abre Gestão de Segurança e leva EPI e treinamentos às rotas certas", () => {
    render(<NavMenu />);
    const desktop = screen.getByRole("navigation");

    fireEvent.click(within(desktop).getByRole("button", { name: /Gestão de Segurança/ }));
    fireEvent.click(within(desktop).getByRole("button", { name: /^EPI/ }));

    expect(hrefsIn(desktop)).toEqual(
      expect.arrayContaining([
        "/service-orders",
        "/epi-catalog",
        "/epi-stock",
        "/epi-returns",
      ]),
    );

    fireEvent.click(within(desktop).getByRole("button", { name: /^Treinamentos/ }));

    expect(hrefsIn(desktop)).toEqual(
      expect.arrayContaining([
        "/training-catalog",
        "/training-compliance",
        "/training-expiry",
      ]),
    );
  });

  it("no desktop, o Cadastro não lista mais EPI, treinamentos nem incidentes", () => {
    render(<NavMenu />);
    const desktop = screen.getByRole("navigation");

    fireEvent.click(within(desktop).getByRole("button", { name: /Cadastro/ }));

    const hrefs = hrefsIn(desktop);
    expect(hrefs).toEqual(expect.arrayContaining(["/companies", "/employees"]));
    expect(hrefs).not.toContain("/epi-catalog");
    expect(hrefs).not.toContain("/training-catalog");
    expect(hrefs).not.toContain("/incidents");
  });

  it("no celular, a gaveta leva a todos os destinos de Segurança e de Medicina", () => {
    render(<NavMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir Menu de Navegação" }));
    const drawer = document.getElementById("nav-mobile-panel");
    expect(drawer).not.toBeNull();
    if (!drawer) return;
    fireEvent.click(within(drawer).getByRole("button", { name: /Gestão de Segurança/ }));
    fireEvent.click(within(drawer).getByRole("button", { name: /Medicina do Trabalho/ }));

    expect(hrefsIn(drawer)).toEqual(
      expect.arrayContaining([
        ...groupHrefs("Gestão de Segurança"),
        ...groupHrefs("Medicina do Trabalho"),
      ]),
    );
  });
});
