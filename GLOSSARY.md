# Dissidia Arena

A hub where a small Dissidia community (012 and NT) queues for ranked 1v1 matches, plays them, and reports the results.

## Competition

**Rating**:
A number measuring a player's skill on one Ladder, which rises and falls with each ranked result.
_Avoid_: Rank, MMR, Elo, points

**Ladder**:
The ranking of players by Rating for one game and platform in a Season. There are three: 012, NT PS4 and NT PC. Region tabs filter a Ladder; they are not separate Ladders.
_Avoid_: Leaderboard, rankings, table

**Season**:
A stretch of time for one game during which ranked results build that game's Ladders (both NT Ladders share one NT Season). Each game always has exactly one live Season, and the next one starts the moment it ends.
_Avoid_: Split, period, league

**Soft reset**:
What happens to every Rating at the start of each Season: it moves halfway back toward the starting Rating, and the system becomes less sure of it.
_Avoid_: Decay, squish

**Hard reset**:
Putting every player on a game's Ladders back to the starting Rating, with the system completely unsure of it, at the start of a Season.
_Avoid_: Wipe, full reset

**Rating reset**:
An Admin putting one player's Rating on one Ladder back to the starting Rating, completely unsure, during the live Season. Other players' Ratings are untouched.
_Avoid_: Rank reset, player wipe

**Settled match**:
A match whose result is final: completed with a winner, or Voided. Only a Settled match moves ranked wins, Ratings or Placement, and only the Master reopening it unsettles it.
_Avoid_: Finished, closed, resolved

**Placement**:
A player's first 5 Settled matches on a Ladder in a Season. Until Placement is done, the player has a Rating but isn't shown on that Ladder.
_Avoid_: Provisional, calibration, unranked

**Ladder position**:
Where a player's Rating places them among other players on a Ladder, such as #3 in EU.
_Avoid_: Rank (on its own), standing

## Administration

**Master**:
The single person with every Admin power, plus the sole power to appoint and remove Admins. Fixed outside the site, so no one can appoint, remove or replace the Master from the website.
_Avoid_: Owner, super admin, root

**Admin**:
A player the Master has appointed to run the site's competitive tools, such as resolving Disputed matches. Admin powers cover both games; there are no per-game Admins.
_Avoid_: Moderator, mod, staff

**Moderator role**:
The Discord role a server names in `/arena setup`, which the bot pings when a match needs an Admin. It grants no powers on the site; only Admins act on cases.
_Avoid_: Admin role, mod (on its own)

**Disputed match**:
A match whose reported result the other player rejected. It has no winner until an Admin gives a Ruling.
_Avoid_: Contested match, dispute ticket

**Ruling**:
An Admin's decision on a Disputed match: Uphold (the reported result stands), Overturn (the other player wins), Replay (the match is played again) or Void (no one wins and there is no rematch).
_Avoid_: Verdict, resolution, decision

**Screenshot**:
An image a player uploads to back up their side of a Disputed match, up to 3 each. The other player and every Admin can see it. It is deleted 90 days after the case closes (the final Ruling, or for a Replay when the replayed match settles), leaving a placeholder, while the statements and the Ruling stay.
_Avoid_: Evidence file, attachment, proof

**Claim**:
An Admin taking sole charge of a Disputed match or Help request. Only the claiming Admin can act on it, until they release it or the Master takes it over.
_Avoid_: Assign, lock, ticket owner

**Help request**:
A player asking the Admins to look at one of their matches that isn't Disputed, for example a vanished opponent or evidence of cheating found later.
_Avoid_: Ticket, report, appeal

**Void**:
An Admin closing a match so it counts for no one: as a Ruling on a Disputed match, or to free players from a stuck match that is still open. Different from a cancelled match, which is one that both players never accepted.
_Avoid_: Cancel, annul, null

**Admin log**:
The permanent record of every Admin and Master action, plus system actions such as auto-confirm: who acted (no one, for a system action), when, and the reason they gave. No one can edit or delete it.
_Avoid_: Audit trail, history

## Interface

**Chaos mode**:
The dark mode of the Rift interface, and the one the site opens in.
_Avoid_: Dark mode, dark theme, Chaos (on its own)

**Cosmos mode**:
The light mode of the Rift interface.
_Avoid_: Light mode, light theme, Cosmos (on its own)

**Cosmos side**:
The side a player always sees themselves on in a match, shown in blue, whichever mode they use.
_Avoid_: Cosmos (on its own), team, player A

**Chaos side**:
The side a player always sees their opponent on in a match, shown in red, whichever mode they use.
_Avoid_: Chaos (on its own), team, player B
