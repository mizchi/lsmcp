export type UserId = string;

export interface User {
  id: UserId;
  name: string;
  email: string;
  isActive: boolean;
}

export class UserService {
  private users: Map<UserId, User> = new Map();

  constructor() {
    this.users = new Map();
  }

  getUser(id: UserId): User | undefined {
    return this.users.get(id);
  }

  createUser(user: User): void {
    this.users.set(user.id, user);
  }

  updateUser(id: UserId, data: Partial<User>): boolean {
    const user = this.users.get(id);
    if (!user) return false;

    Object.assign(user, data);
    return true;
  }

  deleteUser(id: UserId): boolean {
    return this.users.delete(id);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
}

export function createUserId(): UserId {
  return Math.random().toString(36).substring(7);
}
