export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export function calculate(op: string, a: number, b: number): number {
  const calc = new Calculator();
  switch (op) {
    case "add":
      return calc.add(a, b);
    case "subtract":
      return calc.subtract(a, b);
    default:
      throw new Error("Unknown operation");
  }
}
