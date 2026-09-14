export interface User {
  id: number;
  name: string;
}

export function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

const testUser: User = { id: 1, name: "Alice" };

export const message = greetUser(testUser);
