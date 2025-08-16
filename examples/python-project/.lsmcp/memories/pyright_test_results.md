# Pyright Language Server Test Results

## Test Date: 2025-08-14

## Configuration
- Language: Python
- LSP Server: Pyright v1.1.403
- Project: Python example project with intentional errors

## Files Tested

### main.py
- **Total Errors**: 2
- **Error 1** (Line 68): Type error - passing string "5" instead of int to add() method
- **Error 2** (Line 78): Undefined variable - `undefined_variable` is not defined

### errors.py
- **Total Errors**: 7
- **Error 1** (Line 12): Return type mismatch - returning int instead of str
- **Error 2** (Line 18): Undefined variable - `undefined_var` is not defined
- **Error 3** (Line 24): Import error - module `non_existent_module` could not be resolved
- **Error 4** (Line 32): Attribute error - dict has no attribute `append`
- **Error 5** (Line 44): Type error - passing string to function expecting int
- **Error 6** (Line 58): Return type mismatch - returning str instead of int
- **Error 7** (Line 60): Missing return - function must return value on all code paths

## Configuration Fix Applied
- Fixed `pythonVersion` in pyproject.toml from ">=3.12" to "3.12" (Pyright doesn't support version ranges)

## Command Used
```bash
uv run pyright <filename>
```

## Status
✅ Pyright is working correctly and detecting all intentional errors in the test files.