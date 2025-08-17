import { Calculator } from "../src/main";

describe("Calculator", () => {
  const calc = new Calculator();

  test("should add numbers", () => {
    expect(calc.add(2, 3)).toBe(5);
  });

  test("should subtract numbers", () => {
    expect(calc.subtract(5, 3)).toBe(2);
  });
});
