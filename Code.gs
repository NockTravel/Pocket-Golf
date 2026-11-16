/**
 * Pocket Golf 3D — leaderboard backend (Google Apps Script bound to a Google Sheet).
 *
 * Sheets (created automatically on first run):
 *   Players : Name | PinHash | Hcap | Difficulty | Created | LastSeen
 *   Scores  : Time | Name | Course | Type | Key | Strokes | Par | Net | Hcap | Bag | Difficulty
 *   Bests   : a readable summary (rebuilt by the "Rebuild Bests tab" menu item)
 *
 * Type = "hole" (Key = hole number) or "round" (Key = 9f, 9b, 18 or 9).
 * Edit Hcap / Difficulty in the Players tab; the game picks the new values up next time it loads.
 * Difficulty is hidden from players: 0 = normal, 1 = harder, 2 = much harder (decimals allowed).
 */

const MAX_ROWS = 10;      // leaderboard length per hole / round
const CACHE_SECS = 45;

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Pocket Golf")
    .addItem("Set up sheets", "setup")
    .addItem("Rebuild Bests tab", "rebuildBests")
    .addToUi();
}

function setup() {
  sheet_("Players", ["Name", "PinHash", "Hcap", "Difficulty", "Created", "LastSeen"]);
  sheet_("Scores", ["Time", "Name", "Course", "Type", "Key", "Strokes", "Par", "Net", "Hcap", "Bag", "Difficulty"]);
  sheet_("Bests", ["Course", "Type", "Key", "Name", "Best gross", "Best net"]);
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function hash_(pin) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "pg3d:" + String(pin));
  return raw.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}

function cleanName_(n) {
  return String(n || "").replace(/[^\w .'-]/g, "").trim().slice(0, 24);
}

function findPlayer_(name) {
  const sh = sheet_("Players", ["Name", "PinHash", "Hcap", "Difficulty", "Created", "LastSeen"]);
  const vals = sh.getDataRange().getValues();
  const key = name.toLowerCase();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).toLowerCase() === key) {
      return { row: i + 1, name: vals[i][0], pinHash: vals[i][1], hcap: Number(vals[i][2]) || 0, difficulty: Number(vals[i][3]) || 0 };
    }
  }
  return null;
}

function publicPlayer_(p) { return { name: p.name, hcap: p.hcap, difficulty: p.difficulty }; }

// ------------------------------------------------------------------------------ GET
function doGet(e) {
  const p = e.parameter || {};
  try {
    if (p.action === "login") return json_(login_(p.name, p.pin));
    if (p.action === "board") return json_(board_(String(p.course || "")));
    return json_({ ok: true, service: "pocket-golf-3d" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function login_(name, pin) {
  name = cleanName_(name);
  const pl = findPlayer_(name);
  if (!pl) return { ok: false, error: "No player called " + name + " — create one instead." };
  if (pl.pinHash !== hash_(pin)) return { ok: false, error: "Wrong PIN." };
  sheet_("Players", []).getRange(pl.row, 6).setValue(new Date());
  return { ok: true, player: publicPlayer_(pl) };
}

// ------------------------------------------------------------------------------ POST
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.action === "register") return json_(register_(body));
    if (body.action === "scores") return json_(scores_(body.items || []));
    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function register_(b) {
  const name = cleanName_(b.name);
  if (name.length < 2) return { ok: false, error: "Name needs at least 2 letters." };
  if (!/^\d{4}$/.test(String(b.pin))) return { ok: false, error: "PIN must be 4 digits." };
  if (findPlayer_(name)) return { ok: false, error: "That name is taken — sign in instead." };
  const hcap = Math.max(-10, Math.min(54, Math.round(Number(b.hcap) || 0)));
  sheet_("Players", []).appendRow([name, hash_(b.pin), hcap, 0, new Date(), new Date()]);
  return { ok: true, player: { name: name, hcap: hcap, difficulty: 0 } };
}

function scores_(items) {
  const sh = sheet_("Scores", ["Time", "Name", "Course", "Type", "Key", "Strokes", "Par", "Net", "Hcap", "Bag", "Difficulty"]);
  const players = {};
  const rows = [];
  const courses = {};
  items.slice(0, 400).forEach(function (it) {
    const name = cleanName_(it.name);
    const k = name.toLowerCase() + "|" + String(it.pin); // cache per name+PIN so a bad PIN never rides on a good one
    if (!(k in players)) {
      const pl = findPlayer_(name);
      players[k] = pl && pl.pinHash === hash_(it.pin) ? pl : null;
    }
    const pl = players[k];
    if (!pl) return; // unknown player or wrong PIN: drop silently
    const strokes = Math.round(Number(it.strokes));
    const type = it.type === "round" ? "round" : "hole";
    if (!(strokes >= 1 && strokes <= (type === "hole" ? 15 : 200))) return;
    rows.push([new Date(Number(it.ts) || Date.now()), pl.name, String(it.course).slice(0, 40), type, String(it.key).slice(0, 4),
      strokes, Number(it.par) || 0, Number(it.net) || strokes, Number(it.hcap) || 0, String(it.bag || "").slice(0, 40), Number(it.difficulty) || 0]);
    courses[String(it.course)] = true;
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  const cache = CacheService.getScriptCache();
  Object.keys(courses).forEach(function (c) { cache.remove("board_" + c); });
  return { ok: true, saved: rows.length };
}

// ------------------------------------------------------------------------------ leaderboards
function board_(course) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("board_" + course);
  if (hit) return JSON.parse(hit);
  const vals = sheet_("Scores", ["Time", "Name", "Course", "Type", "Key", "Strokes", "Par", "Net", "Hcap", "Bag", "Difficulty"]).getDataRange().getValues();
  const best = { hole: {}, round: {} };
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (String(r[2]) !== course) continue;
    const t = r[3] === "round" ? "round" : "hole", key = String(r[4]), name = String(r[1]);
    const g = Number(r[5]), n = Number(r[7]);
    const per = best[t][key] || (best[t][key] = {});
    const cur = per[name];
    if (!cur) per[name] = { g: g, n: n };
    else { cur.g = Math.min(cur.g, g); cur.n = Math.min(cur.n, n); }
  }
  const toPair = function (per) {
    const names = Object.keys(per);
    const list = function (f) {
      return names.map(function (nm) { return { name: nm, score: per[nm][f] }; })
        .sort(function (a, b) { return a.score - b.score; }).slice(0, MAX_ROWS);
    };
    return { gross: list("g"), net: list("n") };
  };
  const out = { ok: true, holes: {}, rounds: {} };
  Object.keys(best.hole).forEach(function (k) { out.holes[k] = toPair(best.hole[k]); });
  Object.keys(best.round).forEach(function (k) { out.rounds[k] = toPair(best.round[k]); });
  cache.put("board_" + course, JSON.stringify(out), CACHE_SECS);
  return out;
}

/** Writes every player's best per course / hole / round into the Bests tab (for reading in Sheets). */
function rebuildBests() {
  const vals = sheet_("Scores", []).getDataRange().getValues();
  const best = {};
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    const k = [r[2], r[3], r[4], r[1]].join("|");
    const g = Number(r[5]), n = Number(r[7]);
    if (!best[k]) best[k] = [r[2], r[3], r[4], r[1], g, n];
    else { best[k][4] = Math.min(best[k][4], g); best[k][5] = Math.min(best[k][5], n); }
  }
  const rows = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) {
    return String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])) ||
      (Number(a[2]) - Number(b[2]) || String(a[2]).localeCompare(String(b[2]))) || a[4] - b[4];
  });
  const sh = sheet_("Bests", ["Course", "Type", "Key", "Name", "Best gross", "Best net"]);
  sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 6).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
}
