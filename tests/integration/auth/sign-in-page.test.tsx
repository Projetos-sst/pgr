/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`__redirect:${path}`);
  }),
}));

jest.mock("@clerk/nextjs", () => ({
  SignIn: ({ path }: { path: string }) => (
    <div data-testid="clerk-sign-in" data-path={path}>
      sign-in widget
    </div>
  ),
}));

import SignInPage from "@/app/(public)/sign-in/[[...sign-in]]/page";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedRedirect = redirect as unknown as jest.Mock;

describe("SignInPage", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedRedirect.mockClear();
  });

  it("usuário anônimo: monta o <SignIn /> do Clerk com path='/sign-in'", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
    } as unknown as Awaited<ReturnType<typeof auth>>);
    const node = await SignInPage();
    render(node as React.ReactElement);
    const w = screen.getByTestId("clerk-sign-in");
    expect(w).toBeInTheDocument();
    expect(w).toHaveAttribute("data-path", "/sign-in");
  });

  it("usuário já logado: redireciona para /dashboard", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "u1",
    } as unknown as Awaited<ReturnType<typeof auth>>);
    await expect(SignInPage()).rejects.toThrow("__redirect:/dashboard");
    expect(mockedRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
