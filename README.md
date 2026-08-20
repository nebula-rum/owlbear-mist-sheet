# Mist Engine — Hero Sheet (Owlbear Rodeo extension)

A custom Owlbear Rodeo extension for the Mist Engine family of games (City of Mist,
Otherscape, Legend in the Mist, and other hacks built on the same core): Hero sheets with
flip-to-see-tracks Theme cards, burnable Power/Weakness tags, freely editable per-Theme
progress tracks, Backpack, a Resource Pool, Active Statuses, an optional Special Track —
plus a shared **Compagnia** (Company Theme) card and a **GM-managed Roster** that lets the
GM create characters and hand them out to specific players, styled to look like cards
instead of a spreadsheet.

The UI defaults to English with a one-click toggle (top right of the panel) to switch to
Italian at any time — the toggle remembers your choice per browser.

No build step, no framework — just static files. The Owlbear SDK is already bundled locally
(`obr-sdk.bundle.js`), so there's nothing to install.

## How characters work now: the GM builds the Roster

Earlier versions of this extension gave every player their own Hero automatically, tied to
their Owlbear player identity. That's gone. Owlbear's SDK doesn't let one player's browser
write another player's data, so it made it impossible for the GM to reach in and edit a
player's sheet directly (add a Status, fix a tag, etc.). Instead, **all character sheets now
live in shared room data**, and the GM is in charge of who has one and who can see it:

1. The GM opens the **Roster** tab (GM only) and clicks "+ Add Character" for each Hero at
   the table (or an NPC, or a pregen for a one-shot).
2. For each character, the GM sets an **access mode**:
   - **GM only** — hidden from every player. Good for NPCs, secrets, or a sheet that isn't
     ready yet.
   - **Everyone** — every connected player can view *and edit* it. Good for one-shots where
     anyone can grab a pregen.
   - **A specific connected player** — only the GM and that player can view/edit it. This is
     the normal "this is your Hero" case.
3. Players open the **My Sheet** tab and see whichever character(s) the GM has given them.
   Zero accessible characters shows a friendly "ask your GM" message; one shows it directly;
   two or more (e.g. a one-shot with several "Everyone" pregens) shows a small picker to
   switch between them.
4. The GM can also expand any character right there in the Roster tab and edit its full
   sheet inline — same Theme cards, tags, tracks, Backpack, Statuses, everything a player
   sees on My Sheet, just reachable from the GM's side too.

**A note on persistence:** a player's assignment is tied to their Owlbear player ID, which
Owlbear keeps stable for that player rejoining the same room (so normal reconnects, tab
closes, refreshes are all fine). It's not guaranteed to follow the same person if they join
from a different browser or device — if that happens, the GM just re-assigns the character
to their new connection from the Roster tab.

**Same caveat as always:** Owlbear doesn't have real per-role write permissions on shared
room data — hiding the Roster/Settings tabs from non-GM players, and hiding a "GM only" or
someone-else's-assigned character from a player's My Sheet, is a courtesy this extension's
own UI enforces, not a hard lock. That's how every Owlbear extension with GM-only controls
works (there's no enforced multiplayer permission system at the platform level), and it's a
non-issue for a table where everyone is already someone the GM invited.

In local-preview/standalone mode (i.e. testing outside of an actual Owlbear room), all tabs
are always shown and you count as your own "connected player" for assignment, since there's
no real GM/player distinction to check.

## La Compagnia: the shared Company Theme card

The **Compagnia** tab (visible to everyone) is the official Legend in the Mist "Carta Tema
di Compagnia" mechanic — not a party roster summary. It's structured exactly like a personal
Hero Theme (a Mission, 3 Power tags, 1 Weakness tag, three progress tracks, Special
Upgrades), but there's exactly one, shared by the whole party:

- The **GM** has full edit rights: Mission text, tag text, adding/removing tags, the tracks,
  Special Upgrades.
- **Players** see the same card, but everything is read-only for them *except* toggling a
  Power/Weakness tag's used state — per the rules, the Company's Power tags are single-use
  and get **crossed off when activated** (not "burned" for a Potere bonus like a personal
  Hero's tags — different fiction, same click-to-toggle interaction), and any Hero can
  activate them. The GM can similarly activate the Weakness tag against any Hero.

Two related official mechanics — the per-companion "Relazioni della Compagnia" (Company
Relationships) table on each Hero Card, and the "Compimenti" (Fulfillments) tracker — are
**not** implemented yet; they're deferred to a possible follow-up.

## Not tied to one ruleset on purpose

This sheet doesn't hardcode any single game's specific track names or categories (e.g. it
doesn't assume Legend in the Mist's Improve/Milestone/Abandon track system, or any one
game's Theme categories). Instead:

- The **GM sets up Theme categories once per campaign**, in a "Settings" tab only the GM
  can see — e.g. Origin / Adventure / Greatness for Legend in the Mist, or whatever
  categories your game uses. Every player then picks a Theme's category from a small
  dropdown fed by that same list — only the chosen category is shown at a glance, the rest
  stay tucked away until you click it open — so every Hero sheet at the table stays visually
  consistent.
- Each Theme's Tracks are fully freeform: add as many as you want, name them anything, set
  how many dots they need, remove them when not needed. That covers Legend in the Mist's
  3-track system, City of Mist/Otherscape's different progress mechanics, or a homebrew
  hack — whatever your table uses, type it in. The Company Theme uses the same freeform
  tracks.
- The "Special Track" section is an optional extra 5-dot track some tables use for
  endgame/legendary character arcs — check with your table whether/how you use it, or
  ignore it.

## GM-only campaign settings

Click the "Settings" tab (only visible if your Owlbear role in that room is GM — players
don't see it at all) to define the Theme categories your table uses: a label and one of 5
accent colors (amber, teal, violet, rose, sage) per category. It comes pre-seeded with
Origin/Adventure/Greatness (Legend in the Mist's defaults) — rename, recolor, add, or remove
categories freely to match whatever Mist Engine game you're running. This is stored once for
the whole room (not per-player) and syncs live, so every player's category dropdown on their
Theme cards updates immediately.

## Try it before deploying

Open `index.html` directly in a browser (double-click it, or run `python3 -m http.server` in
this folder and visit `http://localhost:8000`). Outside of Owlbear it automatically falls
back to a local-preview mode (data saved in that browser only) so you can click around —
including adding Roster characters and assigning them to "yourself" — and see the real UI
before putting it in your room.

## Deploy it (so Owlbear can load it)

Owlbear extensions are installed from a URL, so this folder needs to live somewhere public first.
Two free, no-code options:

**Option A — Netlify Drop (fastest, no account needed for a quick test)**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page.
3. Netlify gives you a URL like `https://random-name-123.netlify.app`. Your extension manifest is
   then at `https://random-name-123.netlify.app/owlbear-extension.json`.
4. Note: a Netlify Drop site without an account is temporary/reclaimable. Fine for testing; for
   something you'll keep using long-term, make a free Netlify account (or use Option B) so the
   site doesn't get cleaned up while you're mid-campaign.
5. **Gotcha we hit ourselves:** Netlify's platform specifically intercepts any file literally named
   `manifest.json` (it collides with their own web-app-manifest handling) and returns 401
   Unauthorized on it, even though every other file on the same deploy loads fine. That's why this
   file is named `owlbear-extension.json` instead — don't rename it back to `manifest.json` if
   you're on Netlify, or it'll break again. GitHub Pages doesn't have this problem, so the filename
   doesn't matter there.

**Option B — GitHub Pages (free, permanent, needs a GitHub account)**
1. Create a new GitHub repository (public).
2. Upload all the files in this folder to the repo (drag-and-drop on github.com works, no git
   command line needed).
3. In the repo, go to Settings → Pages → set "Source" to the `main` branch, root folder → Save.
4. GitHub gives you a URL like `https://yourusername.github.io/your-repo-name/`. Your extension
   manifest is then at `https://yourusername.github.io/your-repo-name/owlbear-extension.json`.
5. It can take a minute or two the first time for the page to go live.

## Install it in Owlbear Rodeo

1. Open your room in Owlbear Rodeo.
2. Click the puzzle-piece icon in the left toolbar.
3. Choose "Add custom extension" (or similar — the exact label may vary slightly by Owlbear
   version) and paste your `owlbear-extension.json` URL from the deploy step above.
4. A new icon appears in the toolbar — click it to open the Hero Sheet panel.

This same deployed extension works across any of your Mist Engine games/rooms — you don't
need a separate deploy per setting. After installing, the GM should open the Roster tab and
add characters for the table (see "How characters work now" above) — players won't see
anything on My Sheet until the GM has given them one.

## What's namespaced / where data lives

Everything now lives in **room metadata** (not per-player metadata), split into several keys
so different people editing different things at once never clobber each other:

- `com.mistengine.hero-sheet/campaign` → the GM's Theme categories (unchanged from before).
- `com.mistengine.hero-sheet/company` → the shared Compagnia (Company Theme) card.
- `com.mistengine.hero-sheet/roster` → the lightweight index of all characters: id, access
  mode, assigned owner. No sheet contents here, so renaming/reassigning one character never
  touches another's data.
- `com.mistengine.hero-sheet/character/<id>` → one key per character, holding that
  character's full sheet (Themes, Backpack, Resource Pool, Statuses, Special Track, Notes) —
  independently writable, so the GM editing one character in Roster and a player editing
  their own sheet at the same time don't step on each other.

Nothing is sent anywhere outside Owlbear's own infrastructure.

## If you want to change something

Everything is plain HTML/CSS/JS, no build step:
- `app.js` — data model, rendering, all the interaction logic, and the English/Italian label
  dictionary (`LABELS`) near the top of the file — add another language there if you want one.
- `style.css` — the whole visual design (palette is defined as CSS variables at the top; the
  5 Theme accent colors are `--amber`, `--teal`, `--violet`, `--rose`, `--sage`).
- `owlbear-extension.json` — extension metadata Owlbear reads (name, icon, panel size).

After editing, just re-upload the changed file(s) to wherever you deployed it — no rebuild needed.
If you used GitHub Pages, committing the change is enough; it redeploys automatically in a minute
or so.

## Known limitations (being upfront)

- Fonts (Cinzel / EB Garamond) load from Google Fonts over the network — if a player has no
  internet access to Google's CDN, text still renders fine in a plain serif fallback.
- This covers the Hero-side sheet (Themes, Backpack, Resource Pool, Statuses, Special Track,
  Notes) and the Compagnia card. It does not do dice rolling or Power/roll math — that's left
  out on purpose to keep this focused and because it's generally simple enough for a GM to
  track by hand.
- The "Relazioni della Compagnia" (per-companion relationship tags) and "Compimenti"
  (Fulfillments) mechanics from the rulebook aren't implemented yet.
- Statuses tracked here are personal to each character's sheet; they're separate from
  anything you're also tracking on map tokens with other extensions (e.g. Owl Trackers) — the
  two aren't linked.
- This is a bigger architecture change than previous updates (all character data moved from
  per-player metadata into shared room metadata) — it's been tested thoroughly in local
  preview, but worth a real end-to-end check with a second person in an actual Owlbear room
  once deployed.
