import type { Config } from "jest";

const swcTransform: [string, Record<string, unknown>] = [
  "@swc/jest",
  {
    jsc: {
      parser: { syntax: "typescript", tsx: true, decorators: false },
      transform: { react: { runtime: "automatic" } },
      target: "es2022",
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
    module: { type: "commonjs" },
  },
];

const config: Config = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/src/**/__tests__/**/*.test.ts?(x)",
        "<rootDir>/src/__tests__/unit/**/*.test.ts?(x)",
      ],
      testPathIgnorePatterns: ["/node_modules/", "/.next/", "/__tests__/integration/"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
      transform: { "^.+\\.(t|j)sx?$": swcTransform },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts?(x)"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
      transform: { "^.+\\.(t|j)sx?$": swcTransform },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default config;
