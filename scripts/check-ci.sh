#!/bin/bash

# Check CI readiness script
echo "🔍 Checking CI readiness..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all checks pass
ALL_PASS=true

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        return 1
    fi
}

# Function to run check
run_check() {
    echo -e "\n${YELLOW}Running: $1${NC}"
    if eval $2; then
        echo -e "${GREEN}✓ $1 passed${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        ALL_PASS=false
    fi
}

echo -e "\n📦 Checking dependencies..."
check_command "node"
check_command "pnpm"
check_command "git"

echo -e "\n🏗️ Running CI checks..."

# Build
run_check "Build" "pnpm build"

# Type check
run_check "Type check" "pnpm typecheck"

# Lint
run_check "Lint" "pnpm lint"

# Format check
run_check "Format check" "pnpm format:check"

# Unit tests
run_check "Unit tests" "pnpm test:unit"

# Integration tests (with timeout)
run_check "Integration tests" "timeout 300 pnpm test:integration"

# Check examples
run_check "Check examples" "pnpm test:examples"

echo -e "\n📊 Summary:"
if [ "$ALL_PASS" = true ]; then
    echo -e "${GREEN}✅ All CI checks passed!${NC}"
    echo "Ready for GitHub Actions CI/CD"
    exit 0
else
    echo -e "${RED}❌ Some CI checks failed${NC}"
    echo "Please fix the issues before pushing to GitHub"
    exit 1
fi