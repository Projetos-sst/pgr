import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ConfigUrl = z
  .string()
  .url()
  .refine((raw) => {
    const u = new URL(raw);
    if (u.port !== "5432") {
      throw new Error(
        `DATABASE_URL_UNPOOLED MUST use the direct connection (port 5432). Got port=${u.port}.`,
      );
    }
    if (u.username !== "postgres") {
      throw new Error(
        `DATABASE_URL_UNPOOLED MUST authenticate as user 'postgres'. Got user=${u.username}.`,
      );
    }
    return true;
  });

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error("DATABASE_URL_UNPOOLED is not set.");
}
ConfigUrl.parse(url);

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema",
  out: "./lib/db/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
