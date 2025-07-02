"""Test file for Python definitions"""

def greet(name: str) -> str:
    """Greet function"""
    return f"Hello, {name}!"

class Calculator:
    """Simple calculator class"""
    def __init__(self):
        self.value = 0
    
    def add(self, x: int) -> int:
        self.value += x
        return self.value

# Usage
message = greet("Python")
calc = Calculator()
result = calc.add(5)