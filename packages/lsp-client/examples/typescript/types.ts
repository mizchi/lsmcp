export interface Value {
  id: string;
  name: string;
  data: unknown;
}

export interface ValueWithOptional {
  value: Value;
  optional?: string;
}

export function getValue(v: Value): Value {
  return v;
}

export class ValueClass {
  constructor(private value: Value) {}

  getValue(): Value {
    return this.value;
  }
}
