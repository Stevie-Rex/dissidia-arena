## Git workflow

- Every issue gets its own branch. Before any edits, pull `main` and branch off it, named `feat/<short-slug>`, `fix/<short-slug>` or `chore/<short-slug>` (for example `feat/cases-claims-rulings`).
- Never commit issue work directly to `main`. Push the branch and open a PR into `main` that closes the issue.
- Follow-up fixes for an open PR go on that PR's branch.
- In a cloud session, the branch the session is assigned stands in for `feat/<short-slug>`.

## Checks

Backend: `cd backend && .venv/bin/python -m pytest` (setup in `backend/README.md`). Frontend: `cd frontend && npm run lint && npm run build && npm run test:e2e`.

## Research documents

- Never commit research documents, such as the notes in `docs/research/`. They stay on the local machine, so don't add them to any branch or pull request.

## Beta plan

`docs/prd/beta.md` is the plan for the beta: the interface redesign, deployment, mock-data removal and Season 1. Read it before planning or building any of that work.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for Stevie-Rex/dissidia-arena, via the gh CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
