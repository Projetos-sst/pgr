/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

type CreateProps = { afterCreateOrganizationUrl?: string };
type ListProps = { hidePersonal?: boolean; afterSelectOrganizationUrl?: string };

jest.mock("@clerk/nextjs", () => ({
  CreateOrganization: (props: CreateProps) => (
    <div data-testid="create-org" data-after-create={props.afterCreateOrganizationUrl} />
  ),
  OrganizationList: (props: ListProps) => (
    <div
      data-testid="org-list"
      data-hide-personal={String(Boolean(props.hidePersonal))}
      data-after-select={props.afterSelectOrganizationUrl}
    >
      <div data-testid="pending-invitations">convites pendentes (mock)</div>
    </div>
  ),
}));

import OnboardingPage from "@/app/(protected)/onboarding/page";

describe("OnboardingPage", () => {
  it("oferece criação de organização com destino /dashboard (US1)", () => {
    render(<OnboardingPage />);
    expect(screen.getByTestId("create-org")).toHaveAttribute(
      "data-after-create",
      "/dashboard",
    );
  });

  it("exibe a lista de organizações/convites pendentes para aceitar (US5/FR-003)", () => {
    render(<OnboardingPage />);
    const list = screen.getByTestId("org-list");
    expect(list).toHaveAttribute("data-hide-personal", "true");
    expect(list).toHaveAttribute("data-after-select", "/dashboard");
    expect(screen.getByTestId("pending-invitations")).toBeInTheDocument();
  });
});
