/**
 * Example demonstrating line parameter usage in MCP tools
 *
 * You can now specify a line either as:
 * 1. A line number (e.g., line: 10)
 * 2. A string to match (e.g., line: "processData")
 */

function processData(data: string): string {
  return data.toUpperCase();
}

class UserService {
  private users: string[] = [];

  addUser(name: string): void {
    this.users.push(name);
  }

  getUsers(): string[] {
    return this.users;
  }
}

// Example usage:
// To rename 'processData' function:
// - Using line number: { line: 9, symbolName: "processData" }
// - Using string match: { line: "function processData", symbolName: "processData" }
//
// To find references to 'addUser':
// - Using line number: { line: 16, symbolName: "addUser" }
// - Using string match: { line: "addUser(name: string)", symbolName: "addUser" }
