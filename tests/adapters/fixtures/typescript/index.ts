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

// Duplicate function implementation
function greetUser(user: User): string {
  return `Hi, ${user.name}!`;
}

// Duplicate variable declaration
const testUser2: User = {
  id: 2,
  name: "Another User",
  email: "another@example.com",
};

// Another duplicate variable
const invalidUser2: User = {
  id: 3,
  name: "Yet Another User",
  email: "yet@example.com",
};

// Another duplicate with type error
const invalidUser3: User = {
  id: "still-not-a-number", // Type error
  name: "Invalid Again",
  email: "invalid2@example.com",
};

// Another duplicate const
const result2: number = greetUser(testUser2); // Type error
