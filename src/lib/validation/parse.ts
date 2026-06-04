import "server-only";

import type { ZodType } from "zod";
import { ZodError } from "zod";

import { ValidationError } from "./errors";

export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError();
    }
    throw err;
  }
}
