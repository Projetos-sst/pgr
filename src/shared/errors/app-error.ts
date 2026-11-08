import "server-only";

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;
  /** Mensagem por campo do formulário (opcional), repassada em `ActionError.fields`. */
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    if (fields) this.fields = fields;
  }
}
