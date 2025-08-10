# Neverthrow Example Fixture

This directory contains example TypeScript files that use the `neverthrow` library for testing external library symbol resolution.

## Purpose

- Test import parsing for external libraries
- Test symbol resolution from node_modules
- Test filtering of external vs internal symbols
- Verify that symbols like `fromThrowable`, `Result`, `Ok`, `Err` can be found

## Key Symbols to Test

From `neverthrow`:
- `ok` - function to create Ok result
- `err` - function to create Err result  
- `Result` - main Result type
- `ResultAsync` - async version of Result
- `fromThrowable` - convert throwing functions to Result
- `fromAsyncThrowable` - async version
- `Ok` - Ok type
- `Err` - Err type

## Requirements

The main project should have `neverthrow` installed as a dev dependency:
```bash
pnpm add neverthrow --save-dev
```