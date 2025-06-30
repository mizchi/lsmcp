import { Person, UserData } from "./user";

export class UserService {
  private users: Person[] = [];

  addUser(data: UserData): Person {
    const user = new Person(data.id, data.name, data.email);
    this.users.push(user);
    return user;
  }

  findUser(id: number): Person | undefined {
    return this.users.find((user) => user.id === id);
  }
}
