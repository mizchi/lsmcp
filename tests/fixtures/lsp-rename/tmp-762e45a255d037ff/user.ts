export class Person {
  constructor(
    public id: number,
    public name: string,
    public email: string,
  ) {}

  getDisplayName(): string {
    return this.name;
  }
}

export type UserData = {
  id: number;
  name: string;
  email: string;
};
