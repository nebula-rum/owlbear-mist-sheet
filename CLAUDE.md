# Mist Engine — Hero Sheet

A custom Owlbear Rodeo extension: a Theme-card character sheet for Mist Engine games
(City of Mist, Otherscape, Legend in the Mist, homebrew hacks). Plain static site — no
build step, no framework, no dependencies. Live at
`https://nebula-rum.github.io/owlbear-mist-sheet/owlbear-extension.json`, repo
`nebula-rum/owlbear-mist-sheet`.

This file is what a Claude Code session should read first. For the full pass-by-pass
build history — every bug found, every design decision and why, every UI iteration —
see `docs/DEVELOPMENT-LOG.md`. That log is long (35+ passes) but it's the source of
truth for "why does this code do it this weird way" — check it before assuming
something is an oversight.

## Files

- `index.html` — loads `app.js` as an ES module. Renders in three modes depending on
  the query string: default (the popover sheet), `?view=expanded` (a larger modal/
  fullscreen view of the same sheet), `?view=rolllog` (the corner roll-log widget).
- `app.js` — the entire application. One file, no bundler. Verbose, deliberately
  over-commented — many comments exist specifically to record *why* something
  non-obvious is done a certain way (usually because the obvious way was tried first
  and silently broke something). Don't strip these comments during refactors.
- `background.html` — a manifest `background_url` page Owlbear loads once per
  connected player as soon as the room opens. Opens the roll-log corner popover via
  `OBR.popover.open()`. Duplicates a handful of small constants from `app.js` (sizing,
  clearance formulas) because it's a separate script instance that doesn't load the
  rest of the app — comments in both files flag which constants must be kept in sync.
- `style.css` — one stylesheet, plain CSS custom properties for theming (parchment
  palette, accent colors).
- `owlbear-extension.json` — the manifest. Paths are repo-specific absolute paths
  (`/owlbear-mist-sheet/...`) because GitHub Pages serves this as a project site under
  a subpath, not the domain root. A fork needs to update these two paths (see README).
- `icon.svg` — toolbar icon (Theme-card outline + claw-scratch marks), `currentColor`
  throughout so it inherits Owlbear's toolbar tinting.
- `obr-sdk.bundle.js` — the official `@owlbear-rodeo/sdk`, bundled and committed
  directly (no npm install step for this static site).

## Data model

Everything lives in `OBR.room` metadata (never `OBR.player` metadata — a client can
only write its own player metadata, never another connected player's, which is why
character data had to live in room metadata once the GM needed real edit access to
every player's sheet). Split into independently-writable keys so concurrent edits to
different things never clobber each other:

- `com.mistengine.hero-sheet/campaign` → GM-configured, campaign-wide: Theme
  categories (label + accent color), `tagColor`/`statusColor` (Active Tags/Statuses
  accent colors), `trackLabels` (the 3 track names shared by every Theme card).
- `com.mistengine.hero-sheet/company` → the single shared Company Theme card
  ("Compagnia") — same shape as a personal Theme (3 Power tags, 1 Weakness tag,
  Mission, 3 tracks, Special Upgrades), but its Power tags get crossed when used,
  never burned.
- `com.mistengine.hero-sheet/roster` → a lightweight index only:
  `{id, access: "gm" | "everyone" | "assigned", ownerId}` per character. No sheet
  contents here, so renaming/reassigning one character never touches another's data.
- `com.mistengine.hero-sheet/character/<id>` → one key per character, the full sheet
  (name, Background, Themes, Backpack, Active Tags, Statuses, Notes).
- `com.mistengine.hero-sheet/rollLog` → capped array (50 entries, oldest trimmed) of
  roll history: `{id, characterId, characterName, dice, power, total, timestamp}`.

## Tabs

- **Hero** (everyone) — resolves which character(s) this player can access
  (`access === "everyone"`, or `assigned` to them). 0 → "ask your GM". 1 → shown
  directly. 2+ → a small picker.
- **Compagnia** (everyone) — the shared Company Theme. GM full edit; players can only
  toggle a tag's crossed/used state.
- **Roster** (GM only) — add/rename/assign-access/remove characters, plus an inline
  accordion that renders the exact same full sheet editor used on Hero, so the GM can
  fully edit any character's data directly.
- **Settings** (GM only) — Theme categories, track names, Tag/Status colors.

**GM-only gating is a UI-level courtesy, not an OBR-enforced permission.** Owlbear has
no per-role write-permission system on room metadata — any connected client can
technically call `room.setMetadata()`. Checking `OBR.player.getRole() === "GM"` before
rendering a tab/control is the only mechanism available, and it's how every Owlbear
extension with GM-only features works. Non-issue in practice (everyone at the table is
someone the GM invited), but don't describe it to a user as a real security boundary.

## Conventions worth following

- **Verification is always Playwright, standalone-first.** `backend === "standalone"`
  (no real OBR, `OBR.isAvailable` false) is the local-preview fallback used for nearly
  all testing — it's what makes this codebase testable without a live Owlbear room.
  Anything that only exists in real Owlbear (`OBR.popover`, `background_url`,
  `OBR.viewport.getHeight()`, real role gating) needs a **fake-OBR-SDK stub**: swap out
  `obr-sdk.bundle.js` for a small script that intercepts the relevant calls, test
  against that, then restore the real SDK and diff to confirm it's byte-identical to
  what shipped. Several real bugs in this codebase were only found this way (see the
  DEVELOPMENT-LOG's 23rd, 26th, 27th, 28th passes for examples of the technique).
- **`node --check app.js`** before considering any edit done — cheap syntax safety net
  given there's no bundler/type system.
- **Debounced room-metadata saves** (`scheduleRoomSave`) plus `OBR.room.onMetadataChange`
  firing back on the *same* client that made the save (including no-op echoes) is a
  recurring source of real bugs in this codebase's history: stale object identity after
  a swap-in-place, lost typing focus on an echo-triggered re-render, deletes that
  silently no-op. The fixes that stuck: compare with a real `deepEqual` (not
  `JSON.stringify`, which is key-order-sensitive) before treating incoming metadata as
  "changed"; never reassign an object wholesale when nothing actually differs; check
  `document.activeElement` before a destructive re-render and defer it until the
  focused field blurs. If you touch `boot()`'s `onMetadataChange` handler or any
  `bindCharacter`/`bindCompany`-style accessor, re-read the 5th and 27th passes in the
  log first.
- **Ephemeral vs. synced state.** Per-viewer scratch state (ticked-for-roll selection,
  flipped/expanded card state, font size, language, mute, roll-log-hidden) lives in a
  module-level `Set`/`Map` or `localStorage`, never in room metadata. Only actual
  character/campaign data is synced.
- **Verbose, explanatory comments are the house style**, especially on anything where
  the obvious implementation was already tried and found to be wrong. Preserve this
  style in new code — it's what let a fresh session (or a fresh person) pick up 35
  passes of history without re-deriving each bug from scratch.
- **No third-party dice/extension interop.** Rolling is done locally with
  `Math.random()` (2d6 + the sheet's own computed Total Power). This was a deliberate
  choice after checking that no reliable, official cross-extension protocol exists —
  see the 20th and 31st passes if revisiting this.

## Deploying

This repo has no build step — the files in the repo root (plus `docs/`, which is
reference material, not app code) *are* the deployed site. Push to `main`, GitHub Pages
serves it directly. A manifest change (`owlbear-extension.json`) requires an actual
push to take effect for existing installs — Owlbear reads the manifest URL live, not a
bundled copy.

Note for context: every deploy recorded in `docs/DEVELOPMENT-LOG.md` (see the 32nd
pass) was done via browser automation against GitHub's web UI, because the cloud
sandbox those sessions ran in blocks `git push` outright through a mandatory network
proxy. That constraint is specific to that sandboxed environment, not to this
codebase — a normal local `git push` from Claude Code should work fine here. If it
doesn't, don't assume it's the same proxy issue; check credentials/remote config first.
