## Git workflow

- Every issue gets its own branch. Before any edits, pull `main` and branch off it, named `feat/<short-slug>`, `fix/<short-slug>` or `chore/<short-slug>` (for example `feat/cases-claims-rulings`).
- Never commit issue work directly to `main`. Push the branch and open a PR into `main` that closes the issue.
- Follow-up fixes for an open PR go on that PR's branch.
- In a cloud session, the branch the session is assigned stands in for `feat/<short-slug>`.

## Prototype first

Every UI change starts as a prototype: build it in the dev-only `/lab` route (or on a throwaway branch) and get the owner's sign-off before implementing it. A UI change is anything players see: a page, layout, look, copy, motion or interaction. The same goes for a feature whose behaviour isn't settled. A bug fix that restores the signed-off look can skip the prototype.

The pull request for a UI change opens as a draft with before and after screenshots at desktop and phone width, and leaves draft only when the owner signs it off. See "How the work runs" in `docs/prd/beta.md`.

## Local agents (OpenCode)

This section is for a local model run through OpenCode. Your shell is Windows PowerShell. List, search and read files with your built-in glob, list and read tools, and when a ticket's Implementer notes name files, read those exact files directly. Never use shell commands (`ls`, `find`, `grep`, `&&`) to list or search files.

## Checks

Run these in a POSIX shell (Git Bash on Windows; Windows PowerShell 5.1 has no `&&`). Backend: `cd backend && .venv/bin/python -m pytest` (on Windows, `.venv/Scripts/python`; setup in `backend/README.md`). Frontend: `cd frontend && npm run lint && npm run build && npm run test:e2e`.

## Research documents

- Never commit research documents, such as the notes in `docs/research/`. They stay on the local machine, so don't add them to any branch or pull request.

## Beta plan

`docs/prd/beta.md` is the plan for the beta: the interface redesign, deployment, mock-data removal and Season 1. Read it before planning or building any of that work.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for Stevie-Rex/dissidia-arena, via the gh CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
