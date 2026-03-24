---
name: branch
description: Suggest next release branch name based on latest tag
disable-model-invocation: true
user-invocable: true
argument-hint: optional-type (patch|minor|major)
---

Suggest the next release branch name based on the latest git tag.

## Steps

Run in parallel:
1. `git tag --sort=-v:refname | head -5` — latest tags
2. `git branch --show-current` — current branch
3. `git status --short` — check for uncommitted changes

## Version logic

Version format: `v1.X.Y` (semver)

From the latest tag (e.g., `v1.5.1`), determine next version:
- Default (no args or `patch`): bump Y → `v1.5.2`
- `minor`: bump X, reset Y → `v1.6.0`
- `major`: bump major → `v2.0.0`

If $ARGUMENTS is `patch`, `minor`, or `major`, use that. Otherwise default to `patch`.

## Output format

```
Última tag:      v1.5.1
Próxima versão:  v1.5.2
Branch sugerida: release/1.5.2

Quer que eu crie a branch?
```

## Execution

When user confirms, create and checkout the branch:
```bash
git checkout -b release/<version>
```

If there are uncommitted changes, warn the user before creating.