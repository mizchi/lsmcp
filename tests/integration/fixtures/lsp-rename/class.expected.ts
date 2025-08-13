class Person {
  constructor(public name: string) {}

  greet(): string {
    return `Hello, ${this.name}`;
  }
}

const user = new Person("Alice");
console.log(user.greet());

export { Person as User };
