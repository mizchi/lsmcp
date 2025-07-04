// Test file with intentional errors for diagnostics testing

// Type error: string assigned to number
const numberVar: number = "not a number";

// Undefined variable
console.log(undefinedVariable);

// Type mismatch in function parameter
function expectString(s: string): void {
  console.log(s);
}
expectString(123); // Error: number is not assignable to string

// Property doesn't exist
const obj = { a: 1, b: 2 };
console.log(obj.c); // Error: Property 'c' does not exist

// Missing return in function with return type
function mustReturnString(): string {
  console.log("forgot to return");
  // Missing return statement
}

// Incorrect array type
const numberArray: number[] = ["one", "two", "three"];

// Using 'any' type (warning in strict mode)
let anyVar: any = 42;
anyVar = "now a string";

// Unused variable (warning)
const unusedVariable = "I am never used";

// Type assertion error
const someValue: unknown = "this is a string";
const strLength: number = (someValue as number).toFixed(); // Wrong assertion

export {};
