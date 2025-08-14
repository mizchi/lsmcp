// Test file with various symbols
export interface User {
  id: number;
  name: string;
}

export class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }
}

export function createUser(name: string): User {
  return {
    id: Math.random(),
    name,
  };
}

export const DEFAULT_USER: User = {
  id: 0,
  name: "Default",
};

export type UserRole = "admin" | "user" | "guest";
