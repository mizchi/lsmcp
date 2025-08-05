---
created: 2025-08-05T01:46:26.255Z
updated: 2025-08-05T01:46:26.255Z
---

# Code Style and Conventions

## Moonbit Code Style

### Function Definitions
- Use `pub fn` for public functions
- Use `fn` for private functions
- Return type annotation after `->` arrow

Example:
```moonbit
pub fn hello() -> String {
  "Hello, Moonbit!"
}
```

### Structs
- Use `pub struct` for public structs
- Derive traits using `derive()` syntax

Example:
```moonbit
pub struct User {
  name: String
  age: Int
} derive(Show)
```

### Module Imports
- Use `@` prefix for module imports (e.g., `@lib.hello()`)

### Naming Conventions
- **Functions**: snake_case (e.g., `create_user`, `add`)
- **Structs**: PascalCase (e.g., `User`)
- **Variables**: snake_case (e.g., `message`, `result`)

## TypeScript Code Style
- ES modules with `.js` extensions in imports
- Classes with PascalCase (e.g., `MoonbitProjectManager`)
- Type aliases for build targets

## File Organization
- `.mbt` files for Moonbit code
- `.ts` files for TypeScript utilities
- Each package has its own `moon.pkg.json`