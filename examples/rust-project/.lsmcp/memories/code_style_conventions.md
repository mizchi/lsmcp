---
created: 2025-08-05T01:34:14.723Z
updated: 2025-08-05T01:34:14.723Z
---

# Rust Code Style and Conventions

## Naming Conventions
- **Modules/Files**: snake_case (e.g., `test_diagnostics.rs`)
- **Structs/Enums**: PascalCase (e.g., `Calculator`)
- **Functions/Methods**: snake_case (e.g., `get_value`, `greet`)
- **Variables/Parameters**: snake_case (e.g., `value`, `name`)
- **Constants**: SCREAMING_SNAKE_CASE (not present in current code)

## Documentation Style
- Use triple-slash comments (`///`) for public API documentation
- Brief, clear descriptions for structs and functions
- Document parameters and return values when non-obvious
- Example from code:
  ```rust
  /// A simple calculator struct
  pub struct Calculator { ... }
  
  /// Creates a new Calculator with initial value
  pub fn new() -> Self { ... }
  ```

## Code Organization
- Public API items marked with `pub` keyword
- Implementation blocks follow struct definitions
- Tests organized in `#[cfg(test)]` modules within the same file
- Clear separation between library code (`lib.rs`) and executable (`main.rs`)

## Method Chaining
- Methods that modify state return `&mut Self` for chaining:
  ```rust
  calc.add(5.0).subtract(2.0);
  ```

## Error Handling
- Currently using simple patterns without explicit error types
- Test files include intentional errors for diagnostic testing

## Testing Conventions
- Unit tests placed in `mod tests` within the same file
- Test functions prefixed with `test_`
- Use descriptive assertion messages
- Test both positive and edge cases

## Formatting
- Standard Rust formatting via `cargo fmt`
- 4-space indentation (Rust default)
- Opening braces on same line
- Consistent spacing around operators and after commas