import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const noDbInClientBundle = {
  patterns: [
    {
      group: ["@/shared/db", "@/shared/db/**"],
      message:
        "Drizzle/Postgres não pode vazar para o bundle do cliente. Importe @/shared/db apenas em route handlers, Server Actions ou módulos server-only.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", noDbInClientBundle],
    },
  },
  {
    files: ["src/app/api/**/*.{ts,tsx}", "src/app/**/route.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
