
interface User {
  name: string;
  age: number;
}

function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

const testUser: User = {
  name: "Alice",
  age: 30
};

console.log(greetUser(testUser));
