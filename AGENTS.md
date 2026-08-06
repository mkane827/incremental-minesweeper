# Antigravity & Claude Code Alignment

This project uses `CLAUDE.md` as the unified project instruction and architecture document for both Claude Code and Antigravity (AGY).

Please refer to [`CLAUDE.md`](file:///Users/malcolmkane/code/incremental-minesweeper/CLAUDE.md) for full details on architecture, commands, testing, and coding conventions.

## Core Rules & Workflow Sync
1. **Always keep `CLAUDE.md` updated** whenever architectural decisions, new stores, components, or scripts are modified or added.
2. **Testing**: Run unit tests with `npx ng test --watch=false` before finishing any task to ensure all test suites pass.
3. **Angular 21 Conventions**: Use Signals (`signal()`, `computed()`), `OnPush` change detection, pure utility functions, and zoneless configuration.
