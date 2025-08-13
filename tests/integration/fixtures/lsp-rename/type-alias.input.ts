type UserType = {
  id: number;
  name: string;
};

const user: UserType = {
  id: 1,
  name: "Alice",
};

function processUser(u: UserType): string {
  return u.name;
}

console.log(processUser(user));

export type { UserType };
