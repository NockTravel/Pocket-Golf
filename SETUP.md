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
- **Scores tab:** one row per round, filled in hole by hole as it's played (H1 … H18).
  Out / In / Total / Net appear as each nine or the round is finished; Status goes from
  *In progress* to *Complete*. Quit rounds stay *In progress*: their holes still count on the
  hole leaderboards, but not on the 9 / 18-hole ones. Delete a row to remove a round.
- **Players tab:**
  - **Hcap** is automatic: average of the best 3 of the last 10 completed rounds (over par, scaled to
    18 holes). New players start on 18. Put a number in **HcapOverride** to set it by hand
    (clear it to go back to automatic).
  - **Difficulty** is hidden from players: `0` normal, `1` harder, `2` much harder (decimals fine,
    `-1` easier). Faster meters, smaller sweet spot, stronger and shiftier wind.
- **Pocket Golf menu:** *Rebuild Bests tab* (readable best-per-hole/round list) and
  *Recalculate all handicaps* (after deleting or editing rounds by hand).
- PINs are stored hashed. Forgotten PIN: delete that player's row and they can register again.

## Updating the script later
Paste the new code, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
That keeps the same URL, so `config.json` doesn't change.
