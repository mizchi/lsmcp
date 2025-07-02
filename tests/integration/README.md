# Integration Tests

This directory contains integration tests for the LSMCP project.

## Test Categories

- **LSP Integration**: Tests for Language Server Protocol functionality
- **MCP Integration**: Tests for Model Context Protocol server behavior
- **File System Operations**: Tests for real file system interactions
- **Multi-language Support**: Tests for different language servers

## Known Issues

### Flaky Tests

Some integration tests may be flaky due to:

1. **Timing-sensitive LSP operations**: Language servers may take varying
   amounts of time to initialize and process files
2. **File system race conditions**: Creating, modifying, and deleting files can
   have timing issues
3. **Concurrent test execution**: Tests running in parallel may interfere with
   each other

To address these issues:

- Vitest is configured to **retry failed tests up to 2 times**
- Tests use appropriate delays and polling mechanisms
- Temporary directories are used to isolate tests

### Specific Flaky Tests

- `lsp-diagnostics-stale-content.test.ts`: May fail on first run due to LSP
  server initialization timing
- `issue-8-file-system.test.ts`: File system operations may have race conditions

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run a specific test file
pnpm test:integration tests/integration/lsp-diagnostics-stale-content.test.ts

# Run tests with verbose output
DEBUG=1 pnpm test:integration
```

## Writing New Tests

When writing new integration tests:

1. Use proper setup/teardown to clean up resources
2. Add appropriate delays for LSP operations
3. Use polling instead of fixed delays where possible
4. Document any known flakiness in the test file
5. Consider isolating tests that may interfere with others
