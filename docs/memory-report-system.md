# Memory Report System

## What is a Report?

A **Report** in the LSMCP memory system is a comprehensive snapshot of your project's state at a specific point in time (commit). It serves as a temporary investigation record that helps developers understand and track the evolution of their codebase.

## Key Characteristics

### 1. **Temporal Investigation Record**
- Captures the project state at a specific git commit
- Stores both mechanical metrics and AI-generated insights
- Preserves historical context for later reference

### 2. **Not Committed to Repository**
- Stored in `.lsmcp/cache/memory.db` (SQLite database)
- Listed in `.gitignore` to prevent repository bloat
- Local to each developer's environment
- Can be shared via export/import mechanisms if needed

### 3. **Purpose: Later Review and Analysis**
- Track project evolution over time
- Compare states between different branches/commits
- Identify trends in code quality and architecture
- Support decision-making with historical data
- Facilitate code reviews and refactoring planning

## Report Components

### Mechanical Overview (Automatic)
- **File Statistics**: Total files, language distribution
- **Symbol Analysis**: Classes, interfaces, functions, variables
- **Dependencies**: Runtime and development dependencies
- **Directory Structure**: Project organization
- **Language Metrics**: Lines of code per language

### AI Analysis (Optional)
- **Architecture Assessment**: Current architectural patterns
- **Code Quality Metrics**: Maintainability, consistency scores
- **Key Components**: Important modules and their relationships
- **Improvement Suggestions**: Actionable recommendations
- **Technical Debt**: Identified areas needing attention

### Metadata
- **Title**: Descriptive name (auto-generated or custom)
- **Summary**: Brief description of the report
- **Branch**: Git branch name
- **Commit Hash**: Exact commit reference (ensures uniqueness)
- **Timestamp**: When the report was generated

## Use Cases

### 1. **Project Health Monitoring**
```bash
# Generate weekly reports to track project health
lsmcp generate_report --title "Weekly Health Check" --include-ai
```

### 2. **Pre-Release Documentation**
```bash
# Create a detailed report before major releases
lsmcp generate_report --title "v2.0 Release State" --include-ai --prompt "Focus on breaking changes and migration paths"
```

### 3. **Code Review Preparation**
```bash
# Generate report for PR review
lsmcp generate_report --title "Feature X Implementation" --summary "Analysis of new authentication system"
```

### 4. **Technical Debt Tracking**
```bash
# Regular debt assessment
lsmcp generate_report --include-ai --prompt "Identify technical debt and refactoring opportunities"
```

### 5. **Architecture Evolution**
```bash
# Track architectural changes over time
lsmcp get_report_history --limit 10
lsmcp search_reports_by_keyword "architecture"
```

## Why Not Commit Reports?

### 1. **Repository Cleanliness**
- Reports can be large (especially with AI analysis)
- Frequent reports would bloat repository history
- Binary database format not suitable for version control

### 2. **Personal Investigation Tool**
- Each developer may want different analysis perspectives
- Custom AI prompts for specific concerns
- Local experimentation without affecting team

### 3. **Temporal Nature**
- Reports are snapshots, not source of truth
- Code is the authority, reports are observations
- Can be regenerated from any commit

### 4. **Privacy and Security**
- AI analysis might reveal sensitive patterns
- Internal metrics not meant for public repositories
- Developer-specific insights and notes

## Best Practices

### 1. **Regular Generation**
- Create reports at significant milestones
- Before and after major refactoring
- Weekly/monthly health checks

### 2. **Meaningful Titles and Summaries**
```typescript
// Good
title: "Post-OAuth Integration Analysis"
summary: "Security audit after implementing OAuth 2.0 flow"

// Less useful
title: "Report 1"
summary: "Project report"
```

### 3. **Leverage AI Analysis**
- Use specific prompts for targeted insights
- Compare AI assessments over time
- Validate AI suggestions with team

### 4. **Report Lifecycle Management**
```bash
# Prune old reports (keep last 30 days)
lsmcp prune_reports --days 30

# Export important reports before pruning
lsmcp export_report --id <report-id> --format json
```

### 5. **Search and Discovery**
```bash
# Find reports by keyword
lsmcp search_reports_by_keyword "performance"

# Get reports in date range
lsmcp search_reports_by_date --start "2024-01-01" --end "2024-01-31"

# Filter by branch
lsmcp get_all_reports --branch "main" --limit 20
```

## Configuration

Enable advanced memory features in `.lsmcp/config.json`:

```json
{
  "memoryAdvanced": true,
  "reportRetentionDays": 90,
  "autoGenerateOnMerge": false,
  "defaultIncludeAI": false
}
```

## Database Location

Reports are stored in:
```
<project-root>/
  .lsmcp/
    cache/
      memory.db    # SQLite database (not committed)
```

Add to `.gitignore`:
```gitignore
.lsmcp/cache/
```

## Report vs. Other Documentation

| Aspect | Report | README | Code Comments | Git Commit |
|--------|--------|--------|---------------|------------|
| Purpose | Investigation & Analysis | User Guide | Code Explanation | Change History |
| Audience | Developers (self/team) | Users/Contributors | Developers | Everyone |
| Persistence | Local/Temporary | Committed | Committed | Committed |
| Format | Structured Data | Markdown | Inline Text | Text Message |
| Generation | On-demand | Manual | Manual | Every Change |
| Content | Metrics & Insights | Instructions | Implementation | What Changed |

## Summary

Reports are **temporary investigation artifacts** that provide deep insights into your project's state without cluttering the repository. They serve as a powerful tool for understanding code evolution, making informed decisions, and maintaining project health over time.

Think of reports as your project's "medical records" - detailed snapshots that help diagnose issues, track health, and plan improvements, but kept separate from the actual "patient" (your codebase).