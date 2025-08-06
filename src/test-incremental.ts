// Test file for incremental indexing

export function testFunction() {
  console.log("This is a test function");
}

export class TestClass {
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  public greet(): void {
    console.log(`Hello: ${this.message}`);
  }
}

export interface TestInterface {
  name: string;
  value: number;
}

export const TEST_CONSTANT = "test-value";
