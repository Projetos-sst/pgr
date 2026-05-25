import type { Config } from "jest";

const swcTransform: [string, Record<string, unknown>] = [
  "@swc/jest",
  {
    jsc: {
      parser: { syntax: "typescript", tsx: true, decorators: false },
      transform: { react: { runtime: "automatic" } },
      target: "es2022",
      baseUrl: ".",
      paths: { "@/*": ["./*"] },
    },
    module: { type: "commonjs" },
  },
];

const config: Config = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/**/__tests__/**/*.test.ts?(x)"],
      testPathIgnorePatterns: ["/node_modules/", "/.next/", "/tests/integration/"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      transform: { "^.+\\.(t|j)sx?$": swcTransform },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts?(x)"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      transform: { "^.+\\.(t|j)sx?$": swcTransform },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default config;
