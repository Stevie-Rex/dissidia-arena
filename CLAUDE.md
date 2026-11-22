## Git workflow

- Every issue gets its own branch. Before any edits, pull `main` and branch off it, named `feat/<short-slug>`, `fix/<short-slug>` or `chore/<short-slug>` (for example `feat/cases-claims-rulings`).
- Never commit issue work directly to `main`. Push the branch and open a PR into `main` that closes the issue.
- Follow-up fixes for an open PR go on that PR's branch.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for Stevie-Rex/dissidia-arena, via the gh CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
