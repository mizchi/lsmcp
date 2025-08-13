export function formatResult(operation: string, result: number): string {
  return `${operation} result: ${result}`;
}

export function roundTo(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function isEven(num: number): boolean {
  return num % 2 === 0;
}

export const CONSTANTS = {
  PI: 3.14159,
  E: 2.71828,
} as const;
