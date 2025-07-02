interface User {
  id: number;
  name: string;
  email: string;
}

function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

const testUser: User = {
  id: 1,
  name: "Test User",
  email: "test@example.com",
};

console.log(greetUser(testUser));

// This should cause a type error
const invalidUser: User = {
  id: "not-a-number", // Type error: string is not assignable to number
  name: "Invalid User",
  email: "invalid@example.com",
};

// This will also cause a type error
const result: number = greetUser(testUser); // Type error: string is not assignable to number
