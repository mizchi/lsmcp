// Test file with various export patterns

// Non-exported function
function privateFunction() {
  return "private";
}

// Exported function
export function publicFunction() {
  return "public";
}

// Default export
export default function defaultFunction() {
  return "default";
}

// Non-exported class
class PrivateClass {
  private message = "private";
}

// Exported class
export class PublicClass {
  public message = "public";

  private privateMethod() {
    return "private method";
  }

  public publicMethod() {
    return "public method";
  }
}

// Exported interface
export interface PublicInterface {
  name: string;
}

// Non-exported interface
interface PrivateInterface {
  id: number;
}

// Exported const
export const PUBLIC_CONST = "public constant";

// Non-exported const
const PRIVATE_CONST = "private constant";

// Exported type
export type PublicType = string | number;

// Non-exported type
type PrivateType = boolean;

// Named exports
export { privateFunction as renamedFunction };

// Namespace
export namespace PublicNamespace {
  export const namespaceConst = "namespace const";
  const privateNamespaceConst = "private";
}

// New test function for diff index
export function testDiffIndex(): string {
  return "Testing differential index update";
}
