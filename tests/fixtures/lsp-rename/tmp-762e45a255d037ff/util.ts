import { sum } from "./math";

export function doubleAdd(a: number, b: number): number {
  return sum(sum(a, b), sum(a, b));
}

export function testAdd() {
  return sum(1, 2) === 3;
}
