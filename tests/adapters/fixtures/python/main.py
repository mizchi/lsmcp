from typing import List, Dict, Optional


class User:
    def __init__(self, name: str, age: int, email: Optional[str] = None):
        self.name = name
        self.age = age
        self.email = email

    def greet(self) -> str:
        return f"Hello, my name is {self.name} and I'm {self.age} years old."


def process_users(users: List[User]) -> Dict[str, int]:
    """Process a list of users and return a dict of names to ages."""
    result = {}
    for user in users:
        result[user.name] = user.age
    return result


# Example usage
if __name__ == "__main__":
    users = [
        User("Alice", 30, "alice@example.com"),
        User("Bob", 25),
        User("Charlie", 35, "charlie@example.com"),
    ]

    age_map = process_users(users)
    print(f"Age map: {age_map}")

    # This should cause a type error
    invalid_user = User("Dave", "not-a-number")  # Type error: str is not int

    # This will also cause a type error
    result: int = process_users(users)  # Type error: Dict[str, int] is not int
