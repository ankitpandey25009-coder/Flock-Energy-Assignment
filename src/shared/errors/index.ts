export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UpstreamAuthenticationError extends AppError {
  constructor(message = 'Failed to authenticate with upstream portal', details?: unknown) {
    super(message, 502, 'UPSTREAM_AUTH_ERROR', details);
  }
}

export class UpstreamServiceError extends AppError {
  constructor(message = 'Upstream portal returned an unexpected error', statusCode = 502, details?: unknown) {
    super(message, statusCode, 'UPSTREAM_SERVICE_ERROR', details);
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor(message = 'Upstream portal request timed out', details?: unknown) {
    super(message, 504, 'UPSTREAM_TIMEOUT', details);
  }
}
