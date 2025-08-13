class User {
  constructor(public name: string) {}

  greet(): string {
    return `Hello, ${this.name}`;
  }
}

const user = new User("Alice");
console.log(user.greet());

export { User };
