export const x = 1;
export const y = 2;

import { Value } from "./types.ts";

export function processValue(v: Value): string {
  return v.name;
}
