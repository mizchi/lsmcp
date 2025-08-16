// Test file for Variables and Constants indexing

// Regular variables
let myVariable = "test";
var oldStyleVar = 42;

// Constants
const MY_CONSTANT = "CONSTANT_VALUE";
const API_KEY = "secret";
const CONFIG = {
  port: 3000,
  host: "localhost",
};

// Exported variables
export let exportedVariable = "exported";
export const EXPORTED_CONSTANT = 100;

// Module level variables
const modulePrivateConst = "private";
let modulePrivateLet = 123;

// Inside a function
function testFunction() {
  const localConst = "local";
  let localLet = 456;
  var localVar = true;

  return { localConst, localLet, localVar };
}

// Inside a class
class TestClass {
  static readonly STATIC_CONSTANT = "static";
  private privateField = "private";
  public publicField: string = "public";

  constructor() {
    const constructorConst = "constructor";
    let constructorLet = 789;
  }
}

// Destructured variables
const { port, host } = CONFIG;
const [first, second] = [1, 2];

// Arrow function with const
const arrowFunction = () => {
  return "arrow";
};

// Type aliases and interfaces (not variables but often confused)
type MyType = string;
interface MyInterface {
  field: number;
}
