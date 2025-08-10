/**
 * Example TypeScript file using neverthrow library
 * Used for testing external library symbol resolution
 */

import { ok, err, Result, ResultAsync, fromThrowable } from 'neverthrow';

// Example function using Result type
export function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

// Example function using ResultAsync
export function fetchUserData(userId: string): ResultAsync<User, FetchError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${userId}`).then(res => res.json()),
    (error) => new FetchError(String(error))
  );
}

// Example using fromThrowable
const parseJSON = fromThrowable(JSON.parse, (e) => new Error(`Parse error: ${e}`));

export function safeParseJSON(jsonString: string): Result<any, Error> {
  return parseJSON(jsonString);
}

// Type definitions
interface User {
  id: string;
  name: string;
  email: string;
}

class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

// Usage example
const result = divide(10, 2);
if (result.isOk()) {
  console.log('Result:', result.value);
} else {
  console.log('Error:', result.error);
}

// Chain operations
const calculation = ok(10)
  .map(x => x * 2)
  .andThen(x => divide(x, 5))
  .mapErr(e => `Calculation failed: ${e}`);