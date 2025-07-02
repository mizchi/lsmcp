interface User {
  id: number;
  name: string;
  email?: string;
}

class UserService {
  greetUser(user: User): string {
    return `Hello, ${user.name}!`;
  }

  processUsers(users: User[]): Map<string, number> {
    const result = new Map<string, number>();
    for (const user of users) {
      result.set(user.name, user.id);
    }
    return result;
  }
}

// Deno specific imports
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const service = new UserService();

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
];

const idMap = service.processUsers(users);
console.log("User ID map:", idMap);

// This should cause a type error
const invalidUser: User = {
  id: "not-a-number", // Type error: string is not assignable to number
  name: "Invalid",
};

// This will also cause a type error
const result: number = service.processUsers(users); // Type error: Map is not number

// Deno HTTP server example
const handler = (_req: Request): Response => {
  return new Response("Hello from Deno!", {
    headers: { "content-type": "text/plain" },
  });
};

console.log("Server listening on http://localhost:8000");
await serve(handler, { port: 8000 });
