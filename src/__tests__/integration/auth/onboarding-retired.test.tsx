/**
 * @jest-environment jsdom
 */
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`__redirect:${path}`);
  }),
}));

import { redirect } from "next/navigation";
import OnboardingPage from "@/app/(protected)/onboarding/page";

const mockedRedirect = redirect as unknown as jest.Mock;

describe("OnboardingPage (aposentada — spec 005, Modelo B)", () => {
  beforeEach(() => mockedRedirect.mockClear());

  it("redireciona para /welcome (não há mais criação de organização via Clerk)", () => {
    expect(() => OnboardingPage()).toThrow("__redirect:/welcome");
    expect(mockedRedirect).toHaveBeenCalledWith("/welcome");
  });
});
