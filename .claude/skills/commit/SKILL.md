---
name: commit
description: Analyze staged changes and suggest a commit message and branch name
disable-model-invocation: true
user-invocable: true
argument-hint: optional-message
---

Analyze the current git staged changes and suggest a commit message and branch name.

## Steps

Run these commands in parallel:
1. `git diff --cached --stat` — summary of staged changes
2. `git diff --cached` — actual staged diff
3. `git branch --show-current` — current branch
4. `git status --short` — see staged vs unstaged

## Branch naming convention

Based on the diff content, suggest a branch name:
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — maintenance, deps, CI
- `refactor/<short-description>` — code restructuring
- `test/<short-description>` — adding/updating tests
- `docs/<short-description>` — documentation only
- `release/<version>` — release branches

## Commit message convention

Use conventional commits:
```
<type>: <short description>

<optional body with bullet points>
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `ci`

## Output format

```
Branch atual:    release/1.5.0  ✓
Branch sugerida: release/1.5.0  (não precisa mudar)

Commit message:
────────────────────────────────────────
feat: add Playwright e2e tests for API routes

- Add wallet-groups, aggregation, and strategies test suites
- Add authentication validation for all protected endpoints
────────────────────────────────────────
```

If the user passed an argument ($ARGUMENTS), incorporate it as context for the commit message.

If there are NO staged changes, warn the user and show `git status`.

Do NOT create the commit or the branch. Only suggest. Ask "Quer que eu crie?" and wait.
When user says "execute", "sim", or "crie", create the commit immediately without re-asking.

## After commit

After a successful commit, always suggest pushing:
```
Commit criado ✓

Push para origin/<branch>? (s/n)
```

Wait for user confirmation before pushing. When confirmed, run:
```bash
git push -u origin <branch>
```