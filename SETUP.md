# Leaderboard setup (Google Sheets) — about 5 minutes

The game keeps players, scores and leaderboards in a Google Sheet you own, through a small
Apps Script web app (the same approach as the indoor league).

## 1. Create the sheet and script
1. Create a new Google Sheet, e.g. **Pocket Golf Leaderboard**.
2. **Extensions → Apps Script**. Delete the sample code and paste in everything from `backend/Code.gs`. Save.
3. In the function dropdown pick **setup** and press **Run**. Approve the permissions prompt
   (it's your own script; choose your account → Advanced → Go to project).
   Three tabs appear: **Players**, **Scores**, **Bests**.

## 2. Publish it as a web app
1. **Deploy → New deployment →** gear icon **→ Web app**.
2. *Execute as:* **Me**. *Who has access:* **Anyone**.
3. **Deploy**, then copy the **Web app URL** (ends in `/exec`).

## 3. Point the game at it
Edit `config.json` in the root of the GitHub Pages site (next to `index.html`):

```json
{ "leaderboardUrl": "https://script.google.com/macros/s/XXXX/exec" }
```

Commit. Next time anyone opens the game, the title screen shows **Sign in for leaderboards**.
(You can test without committing by opening the game with `?lb=<your /exec URL>` on the end.)

## Day to day
- **Players tab:** edit **Hcap** any time; players pick it up next time they open the game.
- **Difficulty** (hidden from players): `0` normal, `1` harder, `2` much harder; decimals are fine.
  Raises meter speed, shrinks the sweet spot and makes the wind stronger and shiftier.
- **Scores tab:** one row per hole played plus one per completed front 9 / back 9 / 18 (or 9-hole round).
  Delete a row to remove a bad score.
- **Pocket Golf → Rebuild Bests tab** (menu in the sheet) writes everyone's best per hole/round into **Bests**.
- PINs are stored hashed. A forgotten PIN: delete that player's row and they can register again.

## Updating the script later
Paste the new code, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
That keeps the same URL, so `config.json` doesn't change.
