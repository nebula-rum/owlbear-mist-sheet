# Mist Engine — Hero Sheet

A custom Owlbear Rodeo extension for Mist Engine games (Legend in the Mist, City of Mist, Otherscape, and homebrew hacks on the same core). Real Theme cards instead of a spreadsheet, a shared Compagnia/Company Theme card, and a GM-managed Roster — no build step, nothing to install.

**Features**

- Hero sheets with flip Theme cards (front: Power/Weakness tags, Quest; back: 3 tracks, Special Upgrades), Background, Backpack, Resource Pool, Statuses.
- A shared **Compagnia** tab — the party's one Company Theme card.
- A GM-only **Roster** tab: create characters, assign each to a specific player / everyone / GM-only, and edit any character's full sheet directly.
- A GM-only **Settings** tab for campaign Theme categories (colors + labels).
- English/Italian toggle, per-player text size (A−/A+), and an "expand" button that opens a larger view with Theme cards side by side.

## Install

1. In your Owlbear room: puzzle-piece icon → Add custom extension → paste this URL:
   `https://nebula-rum.github.io/owlbear-mist-sheet/owlbear-extension.json`
2. As GM, open **Roster** and add a character for each Hero, assigning who can see/edit it. Players won't see anything on their **Hero** tab until you do this.

That's it — one shared install works across any of your Mist Engine rooms, no per-room setup beyond adding it once.

## GM settings

- **Settings** tab: define your table's Theme categories (label + color). Pre-seeded with Origin/Adventure/Greatness.
- **Roster** tab: add/rename characters, set each one's access (GM only / Everyone / a specific player), expand any character to edit its sheet directly.
- **Compagnia** tab: the shared Company Theme — full edit for you, players can only cross a tag off when activated.

Everything else follows standard Mist Engine mechanics 1:1.

## License

[MIT](LICENSE).

Legend in the Mist, City of Mist, and Otherscape are trademarks of their respective owners. This is an unofficial fan-made tool, not affiliated with or endorsed by them.

## Contributing

It's a few plain files, no build step:

- `app.js` — data model, rendering, the EN/IT `LABELS` dictionary.
- `style.css` — visual design (palette as CSS variables at the top).
- `owlbear-extension.json` — extension manifest Owlbear reads.

Open `index.html` directly in a browser (or `python3 -m http.server`) to preview changes outside Owlbear first — it falls back to local-only storage automatically.

To run your own copy instead of using the hosted link above: fork this repo, enable GitHub Pages (Settings → Pages → Deploy from branch, `main` / root), then point Owlbear at `https://<you>.github.io/<repo>/owlbear-extension.json`.

- **If it doesn't load:** GitHub Pages project repos serve under a subpath, not the domain root. Open `owlbear-extension.json` and change `icon`/`popover` from `/icon.svg` / `/index.html` to `/<repo>/icon.svg` / `/<repo>/index.html`, commit, then reinstall the extension.
- Netlify Drop also works, but don't rename the manifest file to `manifest.json` — it 401s on Netlify. `owlbear-extension.json` is fine as-is.

PRs and forks welcome.
