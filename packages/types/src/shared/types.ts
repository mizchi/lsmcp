/**
 * Common type definitions used across the codebase
 *
 * Note: Utility functions have been moved to errors.ts and utils.ts
 * to avoid duplication and ambiguous exports. This file now contains
 * only type definitions.
 */

/**
 * Type for functions that can be async or sync
 */
export type MaybePromise<T> = T | Promise<T>;

// DeepPartial has been moved to utils.ts to avoid duplicate exports

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
