import { Calculator } from "./calculator.ts";
import { formatResult } from "./utils.ts";

const calc = new Calculator();
const result = calc.add(5, 3);
console.log(formatResult("Addition", result));

export interface User {
  id: number;
  name: string;
}

export function createUser(name: string): User {
  return {
    id: Math.random(),
    name,
  };
}

export type UserAction = "create" | "update" | "delete";
