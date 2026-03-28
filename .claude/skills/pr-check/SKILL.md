---
name: pr-check
description: Check CI status of a PR and suggest merge or investigate failures
user-invocable: true
argument-hint: PR number or URL (optional, defaults to current branch PR)
---

Check CI status for a pull request. If all checks pass, suggest merge. If any fail, investigate the logs and propose fixes.

## Setup

Use the gh CLI at `"/c/Program Files/GitHub CLI/gh.exe"` (full path required on this machine).

## Step 1 — Identify the PR

If $ARGUMENTS is provided (PR number or URL), use it.
Otherwise, detect from current branch:
```bash
"/c/Program Files/GitHub CLI/gh.exe" pr view --json number,url,headRefName,baseRefName,title,state
```

## Step 2 — Get all check runs

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr checks <PR> --watch=false
```

Also fetch structured data:
```bash
"/c/Program Files/GitHub CLI/gh.exe" pr view <PR> --json statusCheckRollup
```

## Step 3 — Evaluate results

Parse the check statuses. Group them:
- **Passed**: conclusion is `SUCCESS` or `NEUTRAL`
- **Pending**: status is `IN_PROGRESS` or `QUEUED`
- **Failed**: conclusion is `FAILURE`, `TIMED_OUT`, `CANCELLED`, or `ACTION_REQUIRED`

### If all checks passed:
Print a summary table of all checks with their status.
Then output:
```
Todos os checks passaram. Quer que eu faça o merge?
```
If user confirms, run:
```bash
"/c/Program Files/GitHub CLI/gh.exe" pr merge <PR> --squash --auto
```

### If checks are still pending:
List which checks are pending and tell the user to run `/pr-check` again when they finish.

### If any check failed:

For each failed check:
1. Get the job logs:
```bash
"/c/Program Files/GitHub CLI/gh.exe" run view <run-id> --log-failed
```
2. Identify the failing step and error message from the logs.
3. Map the failure to the relevant file(s) in the codebase.
4. Investigate the root cause by reading the relevant source files.
5. Propose a concrete fix with code changes.

After investigating all failures, present:
- A clear summary of what failed and why
- Specific code changes needed to fix each failure
- Ask "Quer que eu aplique os fixes?" — if confirmed, implement them directly

## Output format

Always start with a status banner:
- ✅ All checks passed
- ⏳ Checks still running
- ❌ N check(s) failed

Then list each check with its name, status, and duration.
