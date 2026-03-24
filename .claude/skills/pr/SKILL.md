---
name: pr
description: Create a pull request with auto-generated title and description
disable-model-invocation: true
user-invocable: true
argument-hint: base-branch
---

Create a pull request for the current branch.

## Steps

Run in parallel:
1. `git branch --show-current` — current branch
2. `git log <base>..HEAD --oneline` — commits in this branch
3. `git diff <base>...HEAD --stat` — changes summary
4. `git rev-parse --abbrev-ref @{upstream}` — check if pushed

Base branch: use $ARGUMENTS if provided, otherwise default to `main`.

If not pushed, run `git push -u origin <branch>` first.

## PR title convention

- `release/*` → `Release v<version>`
- `feat/*` → Short feature description
- `fix/*` → Short fix description
- Other → Derive from commits

Keep under 70 characters.

## PR description format

```markdown
## Summary
<1-3 bullet points>

## Changes
<Bulleted list grouped by area: Backend, Frontend, CI, etc.>
```

Do NOT include "Test plan" section.
Do NOT include "Generated with Claude Code" or any AI attribution.

## Execution

Use the gh CLI at `"/c/Program Files/GitHub CLI/gh.exe"` (full path required on this machine).

Show title and description, then ask "Quer que eu crie?".
When user confirms, create with:
```bash
"/c/Program Files/GitHub CLI/gh.exe" pr create --title "<title>" --body "<body>" --base <base-branch>
```

Return the PR URL when done.