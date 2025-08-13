type UserData = {
  id: number;
  name: string;
};

const user: UserData = {
  id: 1,
  name: "Alice",
};

function processUser(u: UserData): string {
  return u.name;
}

console.log(processUser(user));

export type { UserData };
