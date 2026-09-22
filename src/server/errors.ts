export class AppError extends Error {}

export class NotFoundError extends AppError {
  constructor(what = "Registro") {
    super(`${what} não encontrado`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(
    public readonly fieldErrors: Record<string, string>,
    message = "Verifique os campos destacados",
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    this.name = "RateLimitError";
  }
}
