/**
 * Bypass dev da REST API falha fechado: sem `APP_ENV` (ausente ou vazio) ou com
 * `production` (qualquer caixa), fica desligado mesmo com a flag ligada.
 */
import {
  isDevAuthBypassEnabled,
  isDevAuthBypassEnabledFor,
} from "@/shared/api/dev-bypass";

describe("isDevAuthBypassEnabledFor", () => {
  it.each([
    ["APP_ENV ausente", { DEV_API_AUTH_BYPASS: "true" }],
    ["APP_ENV vazio", { APP_ENV: "", DEV_API_AUTH_BYPASS: "true" }],
    ["APP_ENV só com espaços", { APP_ENV: "   ", DEV_API_AUTH_BYPASS: "true" }],
    ["production", { APP_ENV: "production", DEV_API_AUTH_BYPASS: "true" }],
    ["PRODUCTION", { APP_ENV: "PRODUCTION", DEV_API_AUTH_BYPASS: "true" }],
    [" Production ", { APP_ENV: " Production ", DEV_API_AUTH_BYPASS: "true" }],
  ])("%s → desligado", (_label, env) => {
    expect(isDevAuthBypassEnabledFor(env)).toBe(false);
  });

  it.each(["local", "development", "homolog"])(
    '%s com flag "true" → ligado',
    (appEnv) => {
      expect(
        isDevAuthBypassEnabledFor({ APP_ENV: appEnv, DEV_API_AUTH_BYPASS: "true" }),
      ).toBe(true);
    },
  );

  it.each([undefined, "", "false", "TRUE", "1", "yes"])(
    'flag %p diferente de "true" → desligado',
    (flag) => {
      expect(
        isDevAuthBypassEnabledFor({ APP_ENV: "local", DEV_API_AUTH_BYPASS: flag }),
      ).toBe(false);
    },
  );
});

describe("isDevAuthBypassEnabled (process.env)", () => {
  const ENV = process.env;
  afterEach(() => {
    process.env = ENV;
  });

  it("sem APP_ENV no processo → desligado", () => {
    process.env = { ...ENV, DEV_API_AUTH_BYPASS: "true" };
    delete process.env.APP_ENV;
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("APP_ENV=local e flag ligada → ligado", () => {
    process.env = { ...ENV, APP_ENV: "local", DEV_API_AUTH_BYPASS: "true" };
    expect(isDevAuthBypassEnabled()).toBe(true);
  });
});
