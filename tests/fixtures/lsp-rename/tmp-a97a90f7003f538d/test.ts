import { Person } from "./user";
import { UserService } from "./service";

describe("User tests", () => {
  it("should create a user", () => {
    const user = new Person(1, "John", "john@example.com");
    expect(user.getDisplayName()).toBe("John");
  });

  it("should work with UserService", () => {
    const service = new UserService();
    const user: Person = service.addUser({
      id: 1,
      name: "Jane",
      email: "jane@example.com",
    });
    expect(user).toBeInstanceOf(Person);
  });
});
