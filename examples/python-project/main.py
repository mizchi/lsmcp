"""
Example Python module for testing pyright language server integration.
"""

from typing import List, Optional, Dict, Any
import json
import os


class Calculator:
    """A simple calculator class for testing."""
    
    def __init__(self) -> None:
        self.history: List[str] = []
    
    def add(self, a: int, b: int) -> int:
        """Add two numbers."""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def subtract(self, a: int, b: int) -> int:
        """Subtract two numbers."""
        result = a - b
        self.history.append(f"{a} - {b} = {result}")
        return result
    
    def multiply(self, a: int, b: int) -> int:
        """Multiply two numbers."""
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result
    
    def divide(self, a: int, b: int) -> float:
        """Divide two numbers."""
        if b == 0:
            raise ValueError("Cannot divide by zero")
        result = a / b
        self.history.append(f"{a} / {b} = {result}")
        return result
    
    def get_history(self) -> List[str]:
        """Get calculation history."""
        return self.history.copy()


def process_data(data: Dict[str, Any]) -> Optional[str]:
    """Process data and return result."""
    if not isinstance(data, dict):
        return None
    
    name = data.get("name")
    if not name:
        return None
    
    return f"Hello, {name}!"


def main() -> None:
    """Main function with some intentional errors for testing."""
    calc = Calculator()
    
    # Normal operations
    result1 = calc.add(5, 3)
    result2 = calc.multiply(4, 7)
    
    # This will cause a type error - passing string instead of int
    result3 = calc.add("5", 3)  # Uncomment to test error detection
    
    # This will cause a runtime error
    # result4 = calc.divide(10, 0)  # Uncomment to test error detection
    
    # Test data processing
    test_data = {"name": "World", "age": 30}
    message = process_data(test_data)
    
    # This will cause a type error - undefined variable
    print(undefined_variable)  # Uncomment to test error detection
    
    print(f"Results: {result1}, {result2}")
    print(f"Message: {message}")
    print(f"History: {calc.get_history()}")


if __name__ == "__main__":
    main()