export interface User {
  id: number;
  name: string;
  email?: string;
}

export class UserService {
  private users: User[] = [];

  constructor() {
    this.users = [];
  }

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  get userCount(): number {
    return this.users.length;
  }
}

export function processUser(user: User): string {
  return `Processing user: ${user.name}`;
}

export const defaultUser: User = {
  id: 0,
  name: "Guest",
  email: undefined,
};
