import "server-only";
import { ValidationError } from "@/shared/errors/validation-error";

export async function readJsonBody(request: Pick<Request, "json">): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    // Request.json may reject with a SyntaxError from another runtime realm.
    if (
      error instanceof SyntaxError ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "SyntaxError")
    ) {
      throw new ValidationError("Corpo JSON inválido.");
    }
    throw error;
  }
}
