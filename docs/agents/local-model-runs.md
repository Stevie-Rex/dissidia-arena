# Local-model run rules

How to write a ticket's Implementer notes so a local coding model can carry them out: Qwen3-Coder-30B in OpenCode, on Windows PowerShell 5.1, with a strict 32K context window. The model reads only what a run hands it, so each run carries everything it needs.

Use these rules when writing Implementer notes for a new ticket, and when rewriting an existing ticket's notes for the local model. A ticket for the local model carries the `model:qwen` label.

## The rules

1. **Self-contained.** Each run inlines its own rules and acceptance criteria, copied from the spec. Name other work by what it built (a route, a function, a field), never by issue number, and never point the model at `docs/prd/`, the spec or any GitHub issue. Give the signatures, columns, routes and response shapes the model needs inline, so it can leave helper files closed.
2. **One run, one prompt.** Split the work into `Run 1`, `Run 2`, `Run 3`, each a standalone copy-pasteable prompt in a fenced `text` block. The person pastes only that block into a fresh OpenCode thread, not the ticket. Each run touches at most 4–5 files.
3. **Full repo-relative paths.** `frontend/src/layouts/RiftLayout.tsx`, `backend/app/lifecycle.py`. Every path starts at the repo root.
4. **PowerShell commands.** Chain with `;` (`cd frontend; npm run lint; npm run build; cd ..`, `cd backend; .venv\Scripts\python -m pytest; cd ..`). Read and search with the model's built-in tools, so no `grep`, `ls` or `&&`. Stage with explicit paths (`git add <path> <path>`), which keeps research documents out of commits.
5. **Fixed first line.** Every run block starts with this line, word for word:

   > Read ONLY the exact files listed in this run using the `read` tool, make the edits, run the PowerShell verification command, commit, and stop. Do not search the repo or read other files.

Line numbers drift, so anchor each one to a function name ("`claim()`, about line 101"). Record any decision the spec left open as **Decision (Claude's):** above the runs. Steps for people, such as opening a draft PR with screenshots, go after the last run, addressed to Claude or the owner.

## Run template

````markdown
## Implementer notes

_For the local coding model (Qwen3-Coder-30B in OpenCode, Windows PowerShell, 32K context). Checked against `main` at <sha>. <When it can start, if it waits on other work.>_

Done in **N runs**, each in a **fresh OpenCode thread**. Paste **only the run block**, not the ticket. Each run is complete on its own.

### Run 1: <what it does>

```text
Read ONLY the exact files listed in this run using the `read` tool, make the edits, run the PowerShell verification command, commit, and stop. Do not search the repo or read other files.

Run 1 of N: <goal in one line>.

FILES (read and edit only these):
- <full/path/one>
- <full/path/two>

FACTS YOU NEED (don't open these files):
- <signatures, columns, routes, response shapes>

RULES:
- <the spec's rules this run implements>

STEPS:
1. <full/path>, `<function>()` (about line N): <change>.

ACCEPTANCE FOR THIS RUN:
- <the spec's acceptance criteria this run meets>

VERIFY (PowerShell, from the repo root):
git checkout main; git pull; git checkout -b <feat/slug>
cd backend; .venv\Scripts\python -m pytest <tests\file.py>; cd ..

If a check fails, fix it and run the check again. Then commit:
git add <full/path/one> <full/path/two>; git commit -m "<message>"

Stop here.
```

### Don't touch (all runs)
<files and areas outside this ticket>
````

Run 2 onwards replaces the branch line with `git checkout <feat/slug>` and opens with "Run 1 is committed on the branch <feat/slug>."

## Rewriting an existing ticket

Keep the ticket's human-readable part as it is and replace everything from `## Implementer notes` down. Check each path, function and line number against `main` before writing it into a run, then update the issue with `gh issue edit <n> --body-file <file>`.
