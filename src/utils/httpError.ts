export class AppError extends Error {
  public readonly statusCode: number;

  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}
