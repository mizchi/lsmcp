/**
 * Common type definitions used across the codebase
 */

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard to check if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if an error has a code property
 */
export function isErrorWithCode(
  error: unknown,
): error is Error & { code: string | number } {
  return isError(error) && hasProperty(error, "code");
}

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(
  error: unknown,
): error is { message: string } {
  return isObject(error) && typeof (error as any).message === "string";
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Safe error code extraction
 */
export function getErrorCode(error: unknown): string | number | undefined {
  if (isErrorWithCode(error)) {
    return error.code;
  }
  if (hasProperty(error, "code")) {
    const code = error.code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }
  }
  return undefined;
}

/**
 * Type for functions that can be async or sync
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
      ? readonly DeepPartial<U>[]
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P];
};

/**
 * Extract the resolved type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Union to intersection type helper
 */
export type UnionToIntersection<U> = (
  U extends any
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;
