# 1. Remove Rift worlds

Date: 2026-11-25. Status: accepted.

## Context

Rift has six worlds: Dissidia, Crystal, Magitek, Mako, Gaia and Ivalice. Each is a light colour palette in `frontend/src/theme/tokens.json`, picked in Config and stored as the `world` field of a player's appearance preferences, in a database column of its own. Worlds are free. No reward unlocks them.

The idea behind them belonged to Classic: themes based on the text boxes of the older Final Fantasy games. Classic already has that, as its window themes (`window_theme`), which unlock with ranked wins. Worlds copied the idea into Rift by mistake, and they don't connect to anything else in the project.

The Stage 1 redesign in `docs/prd/beta.md` makes Rift dark by default, with light as the only other mode. Six palettes in two modes would mean twelve sets of colours to design and run through the contrast checks.

## Decision

Remove worlds completely:

- the world picker in Config and the world tokens;
- the `world` field in the appearance API and the rewards validation;
- the `world` database column, through a migration;
- the world cases in the backend tests and in `frontend/e2e/appearance.spec.ts`, and world handling in the no-flash script in `frontend/index.html`.

Rift's appearance becomes dark or light. Classic's window themes, menu fonts and their unlocks don't change.

## Consequences

- Rift's colours are designed once, in two modes.
- A player's saved world is dropped without a replacement. Nothing was unlocked to get it, so nothing is lost.
- Rift has no cosmetic unlocks of its own once worlds are gone. Rift unlocks are planned as separate work after Stage 1.
