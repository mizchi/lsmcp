"""
Python file with intentional errors for testing diagnostics.
"""

from typing import List, Dict
import json


def function_with_type_error(x: int) -> str:
    """Function that will cause type errors."""
    # Type error: returning int instead of str
    return x + 1


def function_with_undefined_variable() -> None:
    """Function with undefined variable."""
    # NameError: undefined variable
    print(undefined_var)


def function_with_import_error() -> None:
    """Function with import error."""
    # ImportError: non-existent module
    import non_existent_module
    non_existent_module.some_function()


def function_with_attribute_error() -> None:
    """Function with attribute error."""
    data = {"key": "value"}
    # AttributeError: dict has no attribute 'append'
    data.append("item")


def function_with_wrong_type_annotation() -> None:
    """Function with wrong type usage."""
    # Type error: List should be List[something]
    items: List = [1, 2, 3]
    
    # Type error: Dict should be Dict[key_type, value_type]
    mapping: Dict = {"a": 1, "b": 2}
    
    # Type error: passing wrong type to function
    result = function_with_type_error("not an int")
    
    print(items, mapping, result)


class ClassWithErrors:
    """Class with various errors."""
    
    def __init__(self, value: str) -> None:
        self.value = value
    
    def method_with_error(self) -> int:
        """Method that returns wrong type."""
        # Type error: returning str instead of int
        return self.value
    
    def method_with_missing_return(self) -> str:
        """Method that should return but doesn't."""
        # Missing return statement
        print("This method should return a string")


def main() -> None:
    """Main function with errors."""
    # Call functions with errors
    function_with_type_error(42)
    function_with_wrong_type_annotation()
    
    # Create instance with errors
    obj = ClassWithErrors("test")
    result = obj.method_with_error()
    
    print(f"Result: {result}")


if __name__ == "__main__":
    main()