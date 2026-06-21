/**
 * Typed error hierarchy. Every API error code maps to a dedicated class so
 * callers can `catch` and branch with `instanceof`.
 *
 * The backend returns the machine-readable code in the `error` field (not
 * `code`), e.g. `{ "error": "RATE_LIMITED", "message": "..." }`. The HTTP
 * layer extracts it and calls `errorFromResponse`.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_URL"
  | "UNAUTHORIZED"
  | "QUOTA_EXCEEDED"
  | "BLOCKED"
  | "TIMEOUT"
  | "NAVIGATION_FAILED"
  | "SELECTOR_NOT_FOUND"
  | "RATE_LIMITED"
  | "POOL_EXHAUSTED"
  | "NETWORK_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN";

export class SnapshotFlowError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus?: number;
  readonly requestId?: string;
  /** Extra fields from the error body (e.g. `quota` for QUOTA_EXCEEDED). */
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN",
    httpStatus?: number,
    requestId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
    this.details = details;
  }
}

export class ConfigError extends SnapshotFlowError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}
export class NetworkError extends SnapshotFlowError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR");
  }
}
export class ValidationError extends SnapshotFlowError {}
export class InvalidUrlError extends SnapshotFlowError {}
export class AuthError extends SnapshotFlowError {}
export class QuotaExceededError extends SnapshotFlowError {}
export class BlockedUrlError extends SnapshotFlowError {}
export class TimeoutError extends SnapshotFlowError {}
export class NavigationError extends SnapshotFlowError {}
export class SelectorNotFoundError extends SnapshotFlowError {}
export class RateLimitError extends SnapshotFlowError {}
export class PoolExhaustedError extends SnapshotFlowError {}

const CODE_TO_CLASS: Record<string, typeof SnapshotFlowError> = {
  VALIDATION_ERROR: ValidationError,
  INVALID_URL: InvalidUrlError,
  UNAUTHORIZED: AuthError,
  QUOTA_EXCEEDED: QuotaExceededError,
  BLOCKED: BlockedUrlError,
  TIMEOUT: TimeoutError,
  NAVIGATION_FAILED: NavigationError,
  SELECTOR_NOT_FOUND: SelectorNotFoundError,
  RATE_LIMITED: RateLimitError,
  POOL_EXHAUSTED: PoolExhaustedError,
};

const KNOWN_CODES = new Set(Object.keys(CODE_TO_CLASS));

/** Build the right error subclass from an API error response. */
export function errorFromResponse(
  httpStatus: number,
  code: string | undefined,
  message: string | undefined,
  requestId?: string,
  details?: Record<string, unknown>,
): SnapshotFlowError {
  const Cls = (code && CODE_TO_CLASS[code]) || SnapshotFlowError;
  const finalCode: ErrorCode = code && KNOWN_CODES.has(code) ? (code as ErrorCode) : "UNKNOWN";
  return new Cls(
    message || code || `Request failed with status ${httpStatus}`,
    finalCode,
    httpStatus,
    requestId,
    details,
  );
}
