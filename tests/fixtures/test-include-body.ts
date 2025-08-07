// Test file for include_body option testing

// Type alias definition
type UserId = string | number;

// Interface definition
interface User {
  id: UserId;
  name: string;
  email: string;
  createdAt: Date;
}

// Class definition with methods
class UserService {
  private users: Map<UserId, User> = new Map();

  constructor() {
    // Initialize service
  }

  getUser(id: UserId): User | undefined {
    return this.users.get(id);
  }

  createUser(user: User): boolean {
    if (this.users.has(user.id)) {
      return false;
    }
    this.users.set(user.id, user);
    return true;
  }

  updateUser(id: UserId, data: Partial<User>): User | null {
    const existing = this.users.get(id);
    if (!existing) {
      return null;
    }
    const updated = { ...existing, ...data };
    this.users.set(id, updated);
    return updated;
  }

  deleteUser(id: UserId): boolean {
    return this.users.delete(id);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
}

// Function definition
function processUserData(user: User): string {
  // Validate user data
  if (!user.name || !user.email) {
    throw new Error("Invalid user data");
  }

  // Process and format
  const formatted = `${user.name} <${user.email}>`;
  return formatted.toUpperCase();
}

// Arrow function
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Async function
async function fetchUserFromAPI(id: UserId): Promise<User | null> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (id === "test-user-1") {
    return {
      id,
      name: "Test User",
      email: "test@example.com",
      createdAt: new Date(),
    };
  }

  return null;
}

export {
  UserId,
  User,
  UserService,
  processUserData,
  validateEmail,
  fetchUserFromAPI,
};
