# GitHub Direct Workflow

This repository supports a GitHub-native workflow for requesting and shipping code changes end-to-end.

## 1) Open a task in GitHub

1. Create a new issue using **Agent Task Request**.
2. Fill out:
   - Objective
   - Context
   - Acceptance criteria
   - Optional required testing steps
3. Add supporting links (designs, screenshots, related issues).

## 2) Execution model

When working a task, the agent follows this loop:

1. Pull latest branch state.
2. Implement only the requested scope.
3. Validate with focused checks (`npm run lint`, plus targeted manual checks for UI changes).
4. Commit and push code to the current branch.
5. Reference the source GitHub issue in commit message and summary.

## 3) Commit and branch conventions

- Branch naming: `cursor/<short-task-name>` or existing task branch.
- Commit message format:
  - `<type>: <summary> (refs #<issue-number>)`
  - Example: `feat: add google oauth login button (refs #123)`
- Keep commits scoped to one logical change.

## 4) GitHub guardrails

The CI workflow at `.github/workflows/github_direct_ci.yml` runs on pull requests and main/master pushes:

- `npm ci`
- `npm run lint`

This gives immediate signal that GitHub-driven changes meet baseline repo quality.

## 5) Fast request checklist

To speed up turnaround, each task should include:

- Clear goal (what changes, where, why)
- Explicit acceptance criteria
- Any non-goals / constraints
- Exact manual test steps if needed

If a task is ambiguous, request clarification in the issue before implementation.
