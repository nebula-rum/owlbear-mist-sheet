import OBR from "./obr-sdk.bundle.js";

const LANG_KEY = "mist-hero-sheet-lang";
const FONT_SCALE_KEY = "mist-hero-sheet-font-scale";
const COLOR_KEYS = ["amber", "teal", "violet", "rose", "sage"];

// Room metadata keys — everything lives in shared OBR room metadata now (not per-player
// metadata), so the GM can read/write any character, not just their own.
const ROOM_KEYS = {
  campaign: "com.mistengine.hero-sheet/campaign",
  company: "com.mistengine.hero-sheet/company",
  roster: "com.mistengine.hero-sheet/roster",
};
function characterKey(id) {
  return "com.mistengine.hero-sheet/character/" + id;
}
const LOCAL_ROOM_KEY = "mist-hero-sheet-room"; // standalone/local-preview fallback

// The "expanded view" is the same app loaded a second time in a bigger surface (an Owlbear
// Modal, or — outside Owlbear — a plain popup window), so 4 Theme cards can sit side by side
// instead of stacked. This query param is how that second load recognizes itself.
const MODAL_ID = "com.mistengine.hero-sheet/expanded-modal";
const isModalView = new URLSearchParams(window.location.search).get("view") === "expanded";

// ---------- localization ----------

const LABELS = {
  en: {
    standaloneBanner: "Local preview mode (not connected to Owlbear Rodeo) — data is saved only in this browser.",
    footer: "Mist Engine — Hero Sheet · built for Owlbear Rodeo",
    tabSheet: "Hero",
    tabCompany: "Company",
    tabRoster: "Roster",
    tabSettings: "Settings",
    playerLabel: "Player: ",
    roleNarrator: "Narrator",
    langToggleTitle: "Switch to Italian",
    fontDecreaseTitle: "Decrease text size",
    fontIncreaseTitle: "Increase text size",
    expandViewTitle: "Open larger view",
    collapseViewTitle: "Close larger view",

    characterNamePlaceholder: "Character Name",
    backgroundTitle: "Background",
    backgroundPlaceholder: "Write your character's story…",
    themesTitle: "Themes",
    addTheme: (n) => `+ Add Theme (${n}/4)`,
    themeTitlePlaceholder: "Theme Name",
    themeTypePlaceholder: "Type (e.g. Identity, Role, Community…)",
    questionLabel: "Quest",
    questionPlaceholder: "Your Drive / Your Truth / Your Home / Your Question…",
    powerLabel: "Power Tags",
    weaknessLabel: "Weakness Tag",
    addPower: "Add tag",
    addWeakness: "Add weakness tag",
    powerPlaceholder: "tag",
    weaknessPlaceholder: "weakness tag",
    burnTitle: "Burn this tag",
    restoreTitle: "Restore this tag",
    removeTheme: "Delete",
    removeThemeConfirm: "Remove this Theme?",
    flipTitle: "Flip the card",
    tracksTitle: "Tracks",
    trackLabelAbandon: "Abandon",
    trackLabelImprove: "Improve",
    trackLabelAdvance: "Advance",
    defaultTrackLabel: "Track",
    specialLabel: "Special Upgrades",
    specialPlaceholder: "Upgrades unlocked for this Theme…",
    backpackTitle: "Backpack",
    backpackHint: "Click the square to mark an item used.",
    addItem: "+ Item",
    itemPlaceholder: "item…",
    resourcePoolTitle: "Resource Pool",
    statusesTitle: "Active Statuses",
    addStatus: "+ Status",
    statusPlaceholder: "status",
    statusLevelHint: "Click to raise, shift+click to lower",
    notesTitle: "Notes",
    notesPlaceholder: "Free-form notes…",

    settingsTitle: "Theme Categories",
    settingsHint: "Define the Theme categories your table uses (e.g. Origin / Adventure / Greatness for Legend in the Mist) — every player picks from this list, so everyone's cards stay color-consistent. Only you (the GM) can see and edit this tab.",
    addCategory: "+ Category",
    categoryLabelPlaceholder: "Category name",
    removeCategory: "Remove category",
    noCategoriesHint: "Your GM hasn't set up Theme categories yet.",
    unnamedCategory: "(unnamed category)",
    chooseCategory: "Choose a category…",
    defaultCategory1: "Origin",
    defaultCategory2: "Adventure",
    defaultCategory3: "Greatness",

    companyThemeTitle: "Company Theme",
    companyHintGm: "Shared by the whole party. As GM you can edit everything here; players can only cross a tag off when their Hero activates it.",
    companyHintPlayer: "Shared by the whole party. Your GM edits this card; you can still cross off a tag when your Hero activates it.",
    companyMissionLabel: "Mission",
    companyMissionPlaceholder: "What is the Company striving for, together?",
    companyPowerLabel: "Power Tags",
    companyWeaknessLabel: "Weakness Tag",
    companyCrossTitle: "Mark this tag used",
    companyRestoreTitle: "Restore this tag",

    rosterTitle: "Characters",
    rosterHint: "Add a character for each Hero at your table, then choose who can see and edit it. Only you (the GM) see this tab.",
    addCharacter: "+ Add Character",
    rosterEmpty: "No characters yet — add one above.",
    accessLabel: "Visible to",
    accessGm: "GM only",
    accessEveryone: "Everyone",
    removeCharacter: "Remove character",
    removeCharacterConfirm: "Remove this character? This can't be undone.",
    expandCharacter: "▾ Open sheet",
    collapseCharacter: "▴ Close sheet",

    mySheetPickerHint: "You have more than one character — choose which to view:",
    waitingForCharacter: "Your GM hasn't given you a character yet.",
  },
  it: {
    standaloneBanner: "Modalità anteprima locale (non collegata a Owlbear Rodeo) — i dati sono salvati solo in questo browser.",
    footer: "Mist Engine — Scheda Eroe · creata per Owlbear Rodeo",
    tabSheet: "Eroe",
    tabCompany: "Compagnia",
    tabRoster: "Personaggi",
    tabSettings: "Impostazioni",
    playerLabel: "Giocatore: ",
    roleNarrator: "Narratore",
    langToggleTitle: "Switch to English",
    fontDecreaseTitle: "Riduci dimensione testo",
    fontIncreaseTitle: "Aumenta dimensione testo",
    expandViewTitle: "Apri vista grande",
    collapseViewTitle: "Chiudi vista grande",

    characterNamePlaceholder: "Nome dell'Eroe",
    backgroundTitle: "Background",
    backgroundPlaceholder: "Scrivi la storia del tuo personaggio…",
    themesTitle: "Temi",
    addTheme: (n) => `+ Aggiungi Tema (${n}/4)`,
    themeTitlePlaceholder: "Nome del Tema",
    themeTypePlaceholder: "Tipo (es. Identità, Ruolo, Comunità…)",
    questionLabel: "Quest",
    questionPlaceholder: "Il Tuo Desiderio / la Tua Verità / la Tua Casa / la Tua Domanda…",
    powerLabel: "Attributi di Forza",
    weaknessLabel: "Attributo di Debolezza",
    addPower: "Aggiungi attributo",
    addWeakness: "Aggiungi debolezza",
    powerPlaceholder: "attributo",
    weaknessPlaceholder: "attributo di debolezza",
    burnTitle: "Brucia questo attributo",
    restoreTitle: "Ripristina questo attributo",
    removeTheme: "Elimina",
    removeThemeConfirm: "Rimuovere questo Tema?",
    flipTitle: "Gira la carta",
    tracksTitle: "Tracce",
    trackLabelAbandon: "Abbandono",
    trackLabelImprove: "Miglioria",
    trackLabelAdvance: "Avanzamento",
    defaultTrackLabel: "Traccia",
    specialLabel: "Miglioramenti Speciali",
    specialPlaceholder: "Miglioramenti sbloccati per questo Tema…",
    backpackTitle: "Zaino",
    backpackHint: "Clicca il quadrato per barrare un oggetto usato.",
    addItem: "+ Oggetto",
    itemPlaceholder: "oggetto…",
    resourcePoolTitle: "Riserva",
    statusesTitle: "Stati Attivi",
    addStatus: "+ Stato",
    statusPlaceholder: "stato",
    statusLevelHint: "Clicca per aumentare, shift+clicca per diminuire",
    notesTitle: "Note",
    notesPlaceholder: "Appunti liberi…",

    settingsTitle: "Categorie dei Temi",
    settingsHint: "Definisci le categorie di Temi usate al tuo tavolo (es. Origine / Avventura / Grandezza per Legend in the Mist) — ogni giocatore sceglie da questa lista, così le carte di tutti restano coerenti nei colori. Questa scheda è visibile e modificabile solo da te (il Narratore).",
    addCategory: "+ Categoria",
    categoryLabelPlaceholder: "Nome categoria",
    removeCategory: "Rimuovi categoria",
    noCategoriesHint: "Il tuo Narratore non ha ancora configurato le categorie dei Temi.",
    unnamedCategory: "(categoria senza nome)",
    chooseCategory: "Scegli una categoria…",
    defaultCategory1: "Origine",
    defaultCategory2: "Avventura",
    defaultCategory3: "Grandezza",

    companyThemeTitle: "Tema della Compagnia",
    companyHintGm: "Condiviso da tutta la Compagnia. Come Narratore puoi modificare tutto qui; i giocatori possono solo barrare un Attributo quando il loro Eroe lo attiva.",
    companyHintPlayer: "Condiviso da tutta la Compagnia. Questa carta è modificata dal tuo Narratore; puoi comunque barrare un Attributo quando il tuo Eroe lo attiva.",
    companyMissionLabel: "Missione",
    companyMissionPlaceholder: "Qual è l'obiettivo della Compagnia, insieme?",
    companyPowerLabel: "Attributi di Forza",
    companyWeaknessLabel: "Attributo di Debolezza",
    companyCrossTitle: "Barra questo attributo",
    companyRestoreTitle: "Ripristina questo attributo",

    rosterTitle: "Personaggi",
    rosterHint: "Aggiungi un personaggio per ogni Eroe al tuo tavolo, poi scegli chi può vederlo e modificarlo. Solo tu (il Narratore) vedi questa scheda.",
    addCharacter: "+ Aggiungi Personaggio",
    rosterEmpty: "Nessun personaggio ancora — aggiungine uno qui sopra.",
    accessLabel: "Visibile a",
    accessGm: "Solo Narratore",
    accessEveryone: "Tutti",
    removeCharacter: "Rimuovi personaggio",
    removeCharacterConfirm: "Rimuovere questo personaggio? Non può essere annullato.",
    expandCharacter: "▾ Apri scheda",
    collapseCharacter: "▴ Chiudi scheda",

    mySheetPickerHint: "Hai più di un personaggio — scegli quale visualizzare:",
    waitingForCharacter: "Il tuo Narratore non ti ha ancora assegnato un personaggio.",
  },
};

let lang = (localStorage.getItem(LANG_KEY) === "it") ? "it" : "en";

function t(key, ...args) {
  const entry = LABELS[lang][key];
  return typeof entry === "function" ? entry(...args) : entry;
}

function setLang(newLang) {
  lang = newLang;
  localStorage.setItem(LANG_KEY, newLang);
  renderApp();
}

// ---------- font size scaling (per-browser, everyone picks their own) ----------

const FONT_SCALE_STEPS = [13, 15, 17, 19, 21]; // px; index 1 (15px) matches the original default
let fontScaleIndex = (() => {
  const saved = parseInt(localStorage.getItem(FONT_SCALE_KEY), 10);
  return Number.isInteger(saved) && saved >= 0 && saved < FONT_SCALE_STEPS.length ? saved : 1;
})();

function applyFontScale() {
  document.documentElement.style.fontSize = FONT_SCALE_STEPS[fontScaleIndex] + "px";
}

function adjustFontScale(delta) {
  fontScaleIndex = Math.max(0, Math.min(FONT_SCALE_STEPS.length - 1, fontScaleIndex + delta));
  localStorage.setItem(FONT_SCALE_KEY, String(fontScaleIndex));
  applyFontScale();
}

applyFontScale();

// ---------- expanded view (Owlbear Modal / popup window) ----------

function openExpandedView() {
  if (backend === "obr") {
    // Build an already-absolute URL ourselves: Owlbear's SDK resolves a relative "url" by
    // concatenating its own origin with the string with NO separator inserted, which breaks
    // on any site not hosted at the domain root (e.g. a GitHub Pages project repo). Passing
    // a full "https://…" URL sidesteps that entirely, and works regardless of where this is
    // deployed.
    const url = window.location.origin + window.location.pathname + "?view=expanded";
    OBR.modal.open({ id: MODAL_ID, url, width: 1180, height: 820 });
  } else {
    window.open(window.location.pathname + "?view=expanded", "mist-hero-sheet-expanded", "width=1180,height=820");
  }
}

function closeExpandedView() {
  if (backend === "obr") {
    OBR.modal.close(MODAL_ID);
  } else {
    window.close();
  }
}

// ---------- tiny inline icons (SVG, not emoji/unicode glyphs — legible in every font) ----------

function svgIcon(parts, opts = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", opts.viewBox || "0 0 24 24");
  svg.setAttribute("width", String(opts.size || 16));
  svg.setAttribute("height", String(opts.size || 16));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(opts.strokeWidth || 2.2));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  parts.forEach(([tagName, attrs]) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    svg.appendChild(node);
  });
  return svg;
}

function flipIcon() {
  return svgIcon(
    [
      ["polyline", { points: "17 1 21 5 17 9" }],
      ["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
      ["polyline", { points: "7 23 3 19 7 15" }],
      ["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }],
    ],
    { size: 15, strokeWidth: 2.3 }
  );
}

function chevronsDownIcon() {
  return svgIcon(
    [
      ["polyline", { points: "6 4 12 10 18 4" }],
      ["polyline", { points: "6 13 12 19 18 13" }],
    ],
    { size: 13, strokeWidth: 2.6 }
  );
}

function expandIcon() {
  return svgIcon(
    [
      ["polyline", { points: "15 3 21 3 21 9" }],
      ["polyline", { points: "9 21 3 21 3 15" }],
      ["line", { x1: "21", y1: "3", x2: "14", y2: "10" }],
      ["line", { x1: "3", y1: "21", x2: "10", y2: "14" }],
    ],
    { size: 14, strokeWidth: 2.2 }
  );
}

function collapseIcon() {
  return svgIcon(
    [
      ["polyline", { points: "4 14 10 14 10 20" }],
      ["polyline", { points: "20 10 14 10 14 4" }],
      ["line", { x1: "14", y1: "10", x2: "21", y2: "3" }],
      ["line", { x1: "10", y1: "14", x2: "3", y2: "21" }],
    ],
    { size: 14, strokeWidth: 2.2 }
  );
}

// ---------- session state ----------

let backend = "standalone"; // "obr" | "standalone"
let selfId = "local";
let selfName = "";
let selfRole = "PLAYER";
let activeTab = "sheet";
let activeCharacterId = null; // which accessible character "Hero" is currently showing
let expandedRosterId = null; // which character is expanded in the Roster tab (one at a time)
const expandedBackgroundIds = new Set(); // which characters have their Background box open
let partyPlayers = []; // [{id, name, role, metadata}] — everyone except self

function isGM() {
  // Outside Owlbear there's no room/role concept, so GM-only tabs stay visible in
  // standalone/local-preview mode to make it possible to test them.
  return backend !== "obr" || selfRole === "GM";
}

const app = document.getElementById("app");

// ---------- generic dom helper ----------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- room metadata store ----------
// Everything shared (campaign settings, the Company Theme, the character roster index, and
// every individual character's sheet) lives in one flat OBR room-metadata object, one key
// per piece, so two people editing different things never clobber each other.

let roomMeta = {};
const roomSaveTimers = new Map();

async function loadRoomMeta() {
  if (backend === "obr") {
    roomMeta = await OBR.room.getMetadata();
  } else {
    try {
      const raw = localStorage.getItem(LOCAL_ROOM_KEY);
      roomMeta = raw ? JSON.parse(raw) : {};
    } catch {
      roomMeta = {};
    }
  }
}

function scheduleRoomSave(key) {
  clearTimeout(roomSaveTimers.get(key));
  roomSaveTimers.set(
    key,
    setTimeout(() => saveRoomKey(key), 250)
  );
}

async function saveRoomKey(key) {
  if (backend === "obr") {
    try {
      await OBR.room.setMetadata({ [key]: roomMeta[key] });
    } catch (e) {
      console.error("Mist Engine sheet: failed to save room key", key, e);
    }
  } else {
    localStorage.setItem(LOCAL_ROOM_KEY, JSON.stringify(roomMeta));
  }
}

// ---------- campaign settings (GM-only, shared room-wide) ----------

function defaultCategory(label, color) {
  return { id: uid(), label: label || "", color: color || "amber" };
}

function defaultCampaign() {
  return {
    themeCategories: [
      defaultCategory(t("defaultCategory1"), "sage"),
      defaultCategory(t("defaultCategory2"), "amber"),
      defaultCategory(t("defaultCategory3"), "violet"),
    ],
  };
}

function normalizeCampaign(raw) {
  const cats = raw && Array.isArray(raw.themeCategories) ? raw.themeCategories : null;
  return {
    themeCategories: cats
      ? cats.map((cat) => ({
          id: cat && cat.id ? cat.id : uid(),
          label: cat && typeof cat.label === "string" ? cat.label : "",
          color: cat && COLOR_KEYS.includes(cat.color) ? cat.color : "amber",
        }))
      : defaultCampaign().themeCategories,
  };
}

function getCampaign() {
  return normalizeCampaign(roomMeta[ROOM_KEYS.campaign]);
}

function updateCampaign(mutator) {
  const c = getCampaign();
  mutator(c);
  roomMeta[ROOM_KEYS.campaign] = c;
  scheduleRoomSave(ROOM_KEYS.campaign);
}

function categoryColorClass(categoryId) {
  const cat = getCampaign().themeCategories.find((c) => c.id === categoryId);
  return cat ? "color-" + cat.color : "no-category";
}

function pickUnusedColor() {
  const used = new Set(getCampaign().themeCategories.map((c) => c.color));
  return COLOR_KEYS.find((c) => !used.has(c)) || COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
}

// ---------- character data model ----------

function defaultTrack(label) {
  return { id: uid(), label: label || t("defaultTrackLabel"), max: 3, value: 0 };
}

function defaultThemeTracks() {
  return [defaultTrack(t("trackLabelAbandon")), defaultTrack(t("trackLabelImprove")), defaultTrack(t("trackLabelAdvance"))];
}

// Every Theme (personal or the shared Company Theme) has exactly 3 tracks, same as the core
// book — there's no UI to add or remove one, only to rename/progress the 3 that exist.
function ensureThreeTracks(tracks) {
  const list = Array.isArray(tracks) && tracks.length ? tracks.slice() : defaultThemeTracks();
  while (list.length < 3) list.push(defaultTrack());
  return list;
}

function defaultTheme() {
  const cats = getCampaign().themeCategories;
  return {
    id: uid(),
    title: "",
    type: "",
    categoryId: cats.length ? cats[0].id : null,
    question: "",
    power: [],
    weakness: [],
    tracks: defaultThemeTracks(),
    special: "",
  };
}

function defaultCharacter(id) {
  return {
    id,
    name: "",
    background: "",
    themes: [],
    backpack: [],
    resourcePool: 0,
    statuses: [],
    notes: "",
  };
}

function normalizeCharacter(raw, id) {
  const c = Object.assign(defaultCharacter(id), raw || {}, { id });
  c.background = typeof c.background === "string" ? c.background : "";
  c.themes = Array.isArray(c.themes) ? c.themes : [];
  c.backpack = Array.isArray(c.backpack) ? c.backpack : [];
  c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
  c.themes.forEach((th) => {
    th.power = Array.isArray(th.power) ? th.power : [];
    th.weakness = Array.isArray(th.weakness) ? th.weakness : [];
    th.tracks = ensureThreeTracks(th.tracks);
    th.categoryId = typeof th.categoryId === "string" ? th.categoryId : null;
  });
  return c;
}

function getCharacter(id) {
  return normalizeCharacter(roomMeta[characterKey(id)], id);
}

// Loads the character, makes it the live object stored in roomMeta (so in-place mutation +
// scheduleRoomSave works exactly like the rest of the app), and returns {character, save}.
function bindCharacter(id) {
  const character = getCharacter(id);
  roomMeta[characterKey(id)] = character;
  return { character, save: () => scheduleRoomSave(characterKey(id)) };
}

// ---------- roster (GM-managed index of characters) ----------

function defaultRosterEntry(id) {
  return { id, access: "gm", ownerId: null };
}

function normalizeRoster(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.id)
    .map((r) => ({
      id: r.id,
      access: ["gm", "everyone", "assigned"].includes(r.access) ? r.access : "gm",
      ownerId: typeof r.ownerId === "string" ? r.ownerId : null,
    }));
}

function getRoster() {
  return normalizeRoster(roomMeta[ROOM_KEYS.roster]);
}

function updateRoster(mutator) {
  const r = getRoster();
  mutator(r);
  roomMeta[ROOM_KEYS.roster] = r;
  scheduleRoomSave(ROOM_KEYS.roster);
}

function accessibleCharacterIds(playerId) {
  return getRoster()
    .filter((r) => r.access === "everyone" || (r.access === "assigned" && r.ownerId === playerId))
    .map((r) => r.id);
}

function connectedPlayers() {
  const others = partyPlayers.filter((p) => p.id !== selfId).map((p) => ({ id: p.id, name: p.name }));
  return [{ id: selfId, name: selfName }, ...others];
}

// ---------- Company Theme (shared, room-wide) ----------

function defaultCompany() {
  return { power: [], weakness: [], question: "", tracks: defaultThemeTracks(), special: "" };
}

function normalizeCompany(raw) {
  const c = Object.assign(defaultCompany(), raw || {});
  c.power = Array.isArray(c.power) ? c.power : [];
  c.weakness = Array.isArray(c.weakness) ? c.weakness : [];
  c.tracks = ensureThreeTracks(c.tracks);
  return c;
}

function getCompany() {
  return normalizeCompany(roomMeta[ROOM_KEYS.company]);
}

function bindCompany() {
  const company = getCompany();
  roomMeta[ROOM_KEYS.company] = company;
  return { company, save: () => scheduleRoomSave(ROOM_KEYS.company) };
}

// ---------- top-level render ----------

function renderApp() {
  app.innerHTML = "";

  if (backend === "standalone") {
    app.appendChild(el("div", { class: "standalone-banner" }, t("standaloneBanner")));
  }

  if (activeTab === "roster" && !isGM()) activeTab = "sheet";
  if (activeTab === "settings" && !isGM()) activeTab = "sheet";

  app.appendChild(renderTopbar());

  const content = el("div", { id: "tab-content" });
  content.appendChild(renderActiveTab());
  app.appendChild(content);

  app.appendChild(el("footer", { class: "credits" }, t("footer")));
}

function renderActiveTab() {
  if (activeTab === "company") return renderCompanyTab();
  if (activeTab === "roster" && isGM()) return renderRosterTab();
  if (activeTab === "settings" && isGM()) return renderSettingsTab();
  return renderMySheetTab();
}

function refreshTabContent() {
  const content = document.getElementById("tab-content");
  if (!content) return;
  content.innerHTML = "";
  content.appendChild(renderActiveTab());
}

function renderTopbar() {
  const bar = el("div", { class: "topbar" });

  const nameRow = el("div", { class: "hero-name-row" }, [
    el("span", { class: "player-meta-inline", text: t("playerLabel") + selfName }),
    selfRole === "GM" ? el("span", { class: "role-badge", text: t("roleNarrator") }) : null,
  ]);

  const controls = el("div", { class: "topbar-controls" });
  controls.appendChild(
    el("button", {
      class: "icon-btn",
      title: t("fontDecreaseTitle"),
      text: "A−",
      onclick: () => adjustFontScale(-1),
    })
  );
  controls.appendChild(
    el("button", {
      class: "icon-btn",
      title: t("fontIncreaseTitle"),
      text: "A+",
      onclick: () => adjustFontScale(1),
    })
  );
  const expandBtn = el("button", {
    class: "icon-btn",
    title: isModalView ? t("collapseViewTitle") : t("expandViewTitle"),
    onclick: () => (isModalView ? closeExpandedView() : openExpandedView()),
  });
  expandBtn.appendChild(isModalView ? collapseIcon() : expandIcon());
  controls.appendChild(expandBtn);
  controls.appendChild(
    el("button", {
      class: "lang-toggle",
      title: t("langToggleTitle"),
      text: lang === "en" ? "IT" : "EN",
      onclick: () => setLang(lang === "en" ? "it" : "en"),
    })
  );
  nameRow.appendChild(controls);
  bar.appendChild(nameRow);

  const tabButtons = [
    el("button", {
      class: "tab-btn" + (activeTab === "sheet" ? " active" : ""),
      text: t("tabSheet"),
      onclick: () => { activeTab = "sheet"; renderApp(); },
    }),
    el("button", {
      class: "tab-btn" + (activeTab === "company" ? " active" : ""),
      text: t("tabCompany"),
      onclick: () => { activeTab = "company"; renderApp(); },
    }),
  ];
  if (isGM()) {
    tabButtons.push(
      el("button", {
        class: "tab-btn" + (activeTab === "roster" ? " active" : ""),
        text: t("tabRoster"),
        onclick: () => { activeTab = "roster"; renderApp(); },
      }),
      el("button", {
        class: "tab-btn" + (activeTab === "settings" ? " active" : ""),
        text: t("tabSettings"),
        onclick: () => { activeTab = "settings"; renderApp(); },
      })
    );
  }
  bar.appendChild(el("div", { class: "tabs" }, tabButtons));

  return bar;
}

// ---------- Hero tab (My Sheet) ----------

function renderMySheetTab() {
  const wrap = el("div");
  const accessibleIds = accessibleCharacterIds(selfId);

  if (accessibleIds.length === 0) {
    wrap.appendChild(el("div", { class: "party-empty", text: t("waitingForCharacter") }));
    return wrap;
  }

  if (!activeCharacterId || !accessibleIds.includes(activeCharacterId)) {
    activeCharacterId = accessibleIds[0];
  }

  if (accessibleIds.length > 1) {
    const pickerWrap = el("div", { class: "section" });
    pickerWrap.appendChild(el("div", { class: "hint" }, t("mySheetPickerHint")));
    const picker = el("div", { class: "sheet-picker" });
    accessibleIds.forEach((id) => {
      const ch = getCharacter(id);
      picker.appendChild(
        el("button", {
          class: "btn small" + (id === activeCharacterId ? "" : " ghost"),
          text: ch.name || t("characterNamePlaceholder"),
          onclick: () => { activeCharacterId = id; refreshTabContent(); },
        })
      );
    });
    pickerWrap.appendChild(picker);
    wrap.appendChild(pickerWrap);
  }

  const { character, save } = bindCharacter(activeCharacterId);
  wrap.appendChild(renderCharacterSheet(character, save));
  return wrap;
}

// ---------- Character sheet (reused for Hero and the GM's Roster editor) ----------

function renderCharacterSheet(character, save) {
  const wrap = el("div");

  const nameSection = el("div", { class: "section" });
  nameSection.appendChild(
    el("input", {
      class: "character-name-input",
      type: "text",
      placeholder: t("characterNamePlaceholder"),
      value: character.name,
      oninput: (e) => { character.name = e.target.value; save(); },
    })
  );
  wrap.appendChild(nameSection);

  wrap.appendChild(renderBackgroundSection(character, save));

  const themesSection = el("div", { class: "section" });
  themesSection.appendChild(el("div", { class: "section-title" }, [el("span", { text: t("themesTitle") })]));

  const grid = el("div", { class: "themes-grid", id: "themes-grid" });
  character.themes.forEach((theme) => grid.appendChild(renderThemeCard(character, save, theme)));
  if (character.themes.length < 4) {
    grid.appendChild(
      el("button", {
        class: "add-theme-card",
        text: t("addTheme", character.themes.length),
        onclick: () => {
          character.themes.push(defaultTheme());
          save();
          refreshTabContent();
        },
      })
    );
  }
  themesSection.appendChild(grid);
  wrap.appendChild(themesSection);

  wrap.appendChild(renderBackpackSection(character, save));
  wrap.appendChild(renderResourcePoolSection(character, save));
  wrap.appendChild(renderStatusesSection(character, save));
  wrap.appendChild(renderNotesSection(character, save));

  return wrap;
}

// ---------- Background (collapsible free-form character story) ----------

function renderBackgroundSection(character, save) {
  const isOpen = expandedBackgroundIds.has(character.id);
  const section = el("div", { class: "section background-section" });
  section.appendChild(
    el("button", {
      class: "btn small ghost background-toggle",
      text: (isOpen ? "▾ " : "▸ ") + t("backgroundTitle"),
      onclick: () => {
        if (isOpen) expandedBackgroundIds.delete(character.id);
        else expandedBackgroundIds.add(character.id);
        refreshTabContent();
      },
    })
  );
  if (isOpen) {
    section.appendChild(
      el("textarea", {
        class: "background-text",
        placeholder: t("backgroundPlaceholder"),
        oninput: (e) => { character.background = e.target.value; save(); },
      }, character.background || "")
    );
  }
  return section;
}

function replaceThemeCard(character, save, theme) {
  const grid = document.getElementById("themes-grid");
  if (!grid) return;
  const oldNode = grid.querySelector('[data-theme-id="' + theme.id + '"]');
  const newNode = renderThemeCard(character, save, theme);
  if (oldNode) grid.replaceChild(newNode, oldNode);
}

const flippedThemeIds = new Set();

function renderThemeCard(character, save, theme) {
  const isFlipped = flippedThemeIds.has(theme.id);
  const card = el("div", { class: "theme-card" + (isFlipped ? " flipped" : ""), "data-theme-id": theme.id });
  const inner = el("div", { class: "theme-card-inner" });

  inner.appendChild(renderThemeFront(character, save, theme, card));
  inner.appendChild(renderThemeBack(character, save, theme, card));

  card.appendChild(inner);
  return card;
}

function flipCard(themeId, cardNode) {
  if (flippedThemeIds.has(themeId)) flippedThemeIds.delete(themeId);
  else flippedThemeIds.add(themeId);
  cardNode.classList.toggle("flipped");
}

function renderColorSwatchPicker(currentColor, onSelect) {
  const wrap = el("div", { class: "color-picker" });
  COLOR_KEYS.forEach((c) => {
    wrap.appendChild(
      el("button", {
        class: "color-swatch color-" + c + (currentColor === c ? " selected" : ""),
        onclick: () => onSelect(c),
      })
    );
  });
  return wrap;
}

function renderCategoryPicker(theme, save, rerender) {
  const cats = getCampaign().themeCategories;
  if (cats.length === 0) {
    return el("div", { class: "category-picker" }, [
      el("span", { class: "category-empty-hint", text: t("noCategoriesHint") }),
    ]);
  }
  const hasMatch = cats.some((cat) => cat.id === theme.categoryId);
  const options = [];
  if (!hasMatch) {
    options.push(el("option", { value: "", text: t("chooseCategory"), selected: "selected", disabled: "disabled" }));
  }
  cats.forEach((cat) => {
    options.push(
      el("option", {
        value: cat.id,
        text: cat.label || t("unnamedCategory"),
        selected: theme.categoryId === cat.id ? "selected" : undefined,
      })
    );
  });
  const select = el(
    "select",
    {
      class: "category-select " + categoryColorClass(theme.categoryId),
      onchange: (e) => {
        theme.categoryId = e.target.value;
        save();
        rerender();
      },
    },
    options
  );
  return el("div", { class: "category-picker" }, [select]);
}

function renderThemeFront(character, save, theme, cardNode) {
  const face = el("div", { class: "theme-face front " + categoryColorClass(theme.categoryId) });

  const topRow = el("div", { class: "theme-card-topline" });
  topRow.appendChild(renderCategoryPicker(theme, save, () => replaceThemeCard(character, save, theme)));
  const actions = el("div", { class: "theme-card-actions" });
  const flipBtn = el("button", { class: "flip-btn", title: t("flipTitle"), onclick: () => flipCard(theme.id, cardNode) });
  flipBtn.appendChild(flipIcon());
  actions.appendChild(flipBtn);
  actions.appendChild(
    el("button", {
      class: "btn danger small",
      text: t("removeTheme"),
      onclick: () => {
        if (!confirm(t("removeThemeConfirm"))) return;
        character.themes = character.themes.filter((th) => th.id !== theme.id);
        save();
        refreshTabContent();
      },
    })
  );
  topRow.appendChild(actions);
  face.appendChild(topRow);

  face.appendChild(
    el("input", {
      class: "theme-title-input",
      type: "text",
      placeholder: t("themeTitlePlaceholder"),
      value: theme.title,
      oninput: (e) => { theme.title = e.target.value; save(); },
    })
  );

  face.appendChild(
    el("input", {
      class: "theme-type-input",
      type: "text",
      placeholder: t("themeTypePlaceholder"),
      value: theme.type,
      oninput: (e) => { theme.type = e.target.value; save(); },
    })
  );

  face.appendChild(
    renderTagList(theme, "power", false, save, () => replaceThemeCard(character, save, theme), { title: t("powerLabel") })
  );
  face.appendChild(
    renderTagList(theme, "weakness", true, save, () => replaceThemeCard(character, save, theme), { title: t("weaknessLabel") })
  );

  face.appendChild(el("label", { class: "field-label", text: t("questionLabel") }));
  face.appendChild(
    el("textarea", {
      class: "mission-text",
      placeholder: t("questionPlaceholder"),
      oninput: (e) => { theme.question = e.target.value; save(); },
    }, theme.question)
  );

  return face;
}

// Generic tag-list renderer, used for both personal Theme tags and the shared Company
// Theme's tags. `owner` just needs an array at owner[kind]. When `readOnly` is set, tag
// text/add/remove are locked but the burn/cross toggle stays live (used for the Company
// Theme, which non-GM players may only "activate" a tag on, not edit its wording). The
// section title and its inline "+" button are rendered here too, via `opts.title`.
function renderTagList(owner, kind, singleWeakness, save, rerender, opts = {}) {
  const readOnly = !!opts.readOnly;
  const crossTitleOn = opts.burnTitle || t("burnTitle");
  const crossTitleOff = opts.restoreTitle || t("restoreTitle");
  const wrap = el("div");

  const canAdd = !readOnly && !(singleWeakness && owner[kind].length >= 3);
  const header = el("div", { class: "tag-section-header" }, [
    el("label", { class: "field-label", text: opts.title || "" }),
  ]);
  if (canAdd) {
    header.appendChild(
      el("button", {
        class: "tag-add-inline",
        title: kind === "weakness" ? t("addWeakness") : t("addPower"),
        text: "+",
        onclick: () => {
          owner[kind].push({ id: uid(), text: "", burned: false });
          save();
          rerender();
        },
      })
    );
  }
  wrap.appendChild(header);

  const list = el("div", { class: "tag-list" });
  owner[kind].forEach((tag) => {
    const pill = el("div", { class: "tag-pill" + (kind === "weakness" ? " weakness" : "") + (tag.burned ? " burned" : "") });

    const flameBtn = el("button", {
      class: "flame",
      title: tag.burned ? crossTitleOff : crossTitleOn,
      onclick: () => {
        tag.burned = !tag.burned;
        save();
        rerender();
      },
    });
    if (tag.burned) {
      flameBtn.textContent = "🔥";
    } else if (kind === "weakness") {
      flameBtn.appendChild(chevronsDownIcon());
    } else {
      flameBtn.textContent = "⚔";
    }
    pill.appendChild(flameBtn);

    if (readOnly) {
      pill.appendChild(el("span", { class: "tag-text-readonly", text: tag.text || "…" }));
    } else {
      pill.appendChild(
        el("input", {
          type: "text",
          value: tag.text,
          size: String(Math.max(8, tag.text.length + 2)),
          placeholder: kind === "weakness" ? t("weaknessPlaceholder") : t("powerPlaceholder"),
          oninput: (e) => {
            tag.text = e.target.value;
            e.target.size = Math.max(8, e.target.value.length + 2);
            save();
          },
        })
      );
      pill.appendChild(
        el("button", {
          class: "tag-remove",
          text: "✕",
          onclick: () => {
            owner[kind] = owner[kind].filter((tg) => tg.id !== tag.id);
            save();
            rerender();
          },
        })
      );
    }
    list.appendChild(pill);
  });
  wrap.appendChild(list);

  return wrap;
}

function renderThemeBack(character, save, theme, cardNode) {
  const face = el("div", { class: "theme-face back " + categoryColorClass(theme.categoryId) });

  const topRow = el("div", { class: "theme-card-topline" }, [
    el("span", { class: "valore-chip " + categoryColorClass(theme.categoryId), text: t("tracksTitle") }),
  ]);
  const flipBtn = el("button", { class: "flip-btn", title: t("flipTitle"), onclick: () => flipCard(theme.id, cardNode) });
  flipBtn.appendChild(flipIcon());
  topRow.appendChild(flipBtn);
  face.appendChild(topRow);

  face.appendChild(
    renderTracksBlock(theme, save, () => replaceThemeCard(character, save, theme), {
      colorClass: categoryColorClass(theme.categoryId),
    })
  );

  face.appendChild(el("label", { class: "field-label", text: t("specialLabel") }));
  face.appendChild(
    el("textarea", {
      class: "special-text",
      placeholder: t("specialPlaceholder"),
      oninput: (e) => { theme.special = e.target.value; save(); },
    }, theme.special)
  );

  return face;
}

// Generic track-list renderer, used for personal Themes and the Company Theme. `owner`
// needs an array at owner.tracks, always exactly 3 (like the core book) — there's no add or
// remove UI. `readOnly` locks rename/dot-clicks (used for the Company Theme when viewed by a
// non-GM player).
function renderTracksBlock(owner, save, rerender, opts = {}) {
  const readOnly = !!opts.readOnly;
  const colorClass = opts.colorClass || "no-category";
  const wrap = el("div");

  owner.tracks.forEach((track) => {
    const block = el("div", { class: "track-block" });
    const titleRow = el("div", { class: "track-title-row" });
    if (readOnly) {
      titleRow.appendChild(el("span", { class: "track-name", text: track.label }));
    } else {
      titleRow.appendChild(
        el("input", {
          class: "track-name-input",
          type: "text",
          value: track.label,
          oninput: (e) => { track.label = e.target.value; save(); },
        })
      );
    }
    titleRow.appendChild(el("span", { class: "track-name", text: track.value + " / " + track.max }));
    block.appendChild(titleRow);

    const dots = el("div", { class: "dots" });
    for (let i = 0; i < track.max; i++) {
      const filled = track.value > i;
      dots.appendChild(
        el("button", {
          class: "dot" + (filled ? " filled " + colorClass : ""),
          title: String(i + 1),
          disabled: readOnly ? "disabled" : undefined,
          onclick: readOnly
            ? undefined
            : () => {
                track.value = track.value === i + 1 ? i : i + 1;
                save();
                rerender();
              },
        })
      );
    }
    block.appendChild(dots);
    wrap.appendChild(block);
  });

  return wrap;
}

// ---------- Backpack ----------

function renderBackpackSection(character, save) {
  const section = el("div", { class: "section" });
  section.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("backpackTitle") }),
      el("button", {
        class: "btn small add-btn",
        text: t("addItem"),
        onclick: () => {
          character.backpack.push({ id: uid(), text: "", used: false });
          save();
          refreshTabContent();
        },
      }),
    ])
  );
  section.appendChild(el("div", { class: "hint" }, t("backpackHint")));

  const rows = el("div", { class: "list-rows" });
  character.backpack.forEach((item) => {
    const row = el("div", { class: "list-row" + (item.used ? " used" : "") });
    row.appendChild(
      el("button", {
        class: "check-toggle" + (item.used ? " checked" : ""),
        onclick: () => {
          item.used = !item.used;
          save();
          refreshTabContent();
        },
      })
    );
    row.appendChild(
      el("input", {
        type: "text",
        placeholder: t("itemPlaceholder"),
        value: item.text,
        oninput: (e) => { item.text = e.target.value; save(); },
      })
    );
    row.appendChild(
      el("button", {
        class: "tag-remove",
        text: "✕",
        onclick: () => {
          character.backpack = character.backpack.filter((i) => i.id !== item.id);
          save();
          refreshTabContent();
        },
      })
    );
    rows.appendChild(row);
  });
  section.appendChild(rows);
  return section;
}

// ---------- Resource Pool ----------

function renderResourcePoolSection(character, save) {
  const section = el("div", { class: "section" });
  section.appendChild(el("div", { class: "section-title" }, [el("span", { text: t("resourcePoolTitle") })]));
  const row = el("div", { class: "quint-row" });
  row.appendChild(
    el("button", { class: "btn small", text: "−", onclick: () => {
      character.resourcePool = Math.max(0, character.resourcePool - 1);
      save();
      refreshTabContent();
    } })
  );
  row.appendChild(el("span", { class: "quint-gems", text: "◆".repeat(character.resourcePool) || "—" }));
  row.appendChild(
    el("button", { class: "btn small", text: "+", onclick: () => {
      character.resourcePool += 1;
      save();
      refreshTabContent();
    } })
  );
  section.appendChild(row);
  return section;
}

// ---------- Statuses ----------

function renderStatusesSection(character, save) {
  const section = el("div", { class: "section" });
  section.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("statusesTitle") }),
      el("button", {
        class: "btn small add-btn",
        text: t("addStatus"),
        onclick: () => {
          character.statuses.push({ id: uid(), name: "", level: 1 });
          save();
          refreshTabContent();
        },
      }),
    ])
  );
  const list = el("div", { class: "status-list" });
  character.statuses.forEach((s) => {
    const chip = el("div", { class: "status-chip" });
    chip.appendChild(
      el("input", {
        type: "text",
        value: s.name,
        placeholder: t("statusPlaceholder"),
        oninput: (e) => { s.name = e.target.value; save(); },
      })
    );
    chip.appendChild(
      el("button", {
        class: "lvl",
        text: String(s.level),
        title: t("statusLevelHint"),
        onclick: (e) => {
          s.level = e.shiftKey ? Math.max(1, s.level - 1) : s.level + 1;
          save();
          refreshTabContent();
        },
      })
    );
    chip.appendChild(
      el("button", {
        class: "tag-remove",
        text: "✕",
        onclick: () => {
          character.statuses = character.statuses.filter((x) => x.id !== s.id);
          save();
          refreshTabContent();
        },
      })
    );
    list.appendChild(chip);
  });
  section.appendChild(list);
  return section;
}

// ---------- Notes ----------

function renderNotesSection(character, save) {
  const section = el("div", { class: "section" });
  section.appendChild(el("div", { class: "section-title" }, [el("span", { text: t("notesTitle") })]));
  section.appendChild(
    el("textarea", {
      class: "notes-text",
      placeholder: t("notesPlaceholder"),
      oninput: (e) => { character.notes = e.target.value; save(); },
    }, character.notes)
  );
  return section;
}

// ---------- Company tab (shared Company Theme) ----------

function renderCompanyTab() {
  const wrap = el("div", { class: "section" });
  const gm = isGM();
  const { company, save } = bindCompany();

  wrap.appendChild(el("div", { class: "section-title" }, [el("span", { text: t("companyThemeTitle") })]));
  wrap.appendChild(el("div", { class: "hint" }, gm ? t("companyHintGm") : t("companyHintPlayer")));

  const card = el("div", { class: "company-card" });

  card.appendChild(el("label", { class: "field-label", text: t("companyMissionLabel") }));
  if (gm) {
    card.appendChild(
      el("textarea", {
        class: "mission-text",
        placeholder: t("companyMissionPlaceholder"),
        oninput: (e) => { company.question = e.target.value; save(); },
      }, company.question)
    );
  } else {
    card.appendChild(el("div", { class: "gm-full-line", text: company.question || "—" }));
  }

  card.appendChild(
    renderTagList(company, "power", false, save, () => refreshTabContent(), {
      readOnly: !gm,
      title: t("companyPowerLabel"),
      burnTitle: t("companyCrossTitle"),
      restoreTitle: t("companyRestoreTitle"),
    })
  );

  card.appendChild(
    renderTagList(company, "weakness", true, save, () => refreshTabContent(), {
      readOnly: !gm,
      title: t("companyWeaknessLabel"),
      burnTitle: t("companyCrossTitle"),
      restoreTitle: t("companyRestoreTitle"),
    })
  );

  card.appendChild(el("label", { class: "field-label", text: t("tracksTitle") }));
  card.appendChild(
    renderTracksBlock(company, save, () => refreshTabContent(), { readOnly: !gm, colorClass: "color-violet" })
  );

  card.appendChild(el("label", { class: "field-label", text: t("specialLabel") }));
  if (gm) {
    card.appendChild(
      el("textarea", {
        class: "special-text",
        placeholder: t("specialPlaceholder"),
        oninput: (e) => { company.special = e.target.value; save(); },
      }, company.special)
    );
  } else {
    card.appendChild(el("div", { class: "gm-full-line", text: company.special || "—" }));
  }

  wrap.appendChild(card);
  return wrap;
}

// ---------- Roster tab (GM only) ----------

function renderRosterTab() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("rosterTitle") }),
      el("button", {
        class: "btn small add-btn",
        text: t("addCharacter"),
        onclick: () => {
          const id = uid();
          updateRoster((r) => r.push(defaultRosterEntry(id)));
          roomMeta[characterKey(id)] = defaultCharacter(id);
          scheduleRoomSave(characterKey(id));
          expandedRosterId = id;
          refreshTabContent();
        },
      }),
    ])
  );
  wrap.appendChild(el("div", { class: "hint" }, t("rosterHint")));

  const roster = getRoster();
  if (roster.length === 0) {
    wrap.appendChild(el("div", { class: "party-empty", text: t("rosterEmpty") }));
    return wrap;
  }

  const players = connectedPlayers();

  roster.forEach((entry) => {
    const character = getCharacter(entry.id);
    const rowWrap = el("div", { class: "roster-item" });
    const row = el("div", { class: "roster-row" });

    row.appendChild(
      el("input", {
        type: "text",
        class: "roster-name-input",
        placeholder: t("characterNamePlaceholder"),
        value: character.name,
        oninput: (e) => {
          const { character: c, save } = bindCharacter(entry.id);
          c.name = e.target.value;
          save();
        },
      })
    );

    const accessOptions = [
      el("option", { value: "gm", text: t("accessGm"), selected: entry.access === "gm" ? "selected" : undefined }),
      el("option", { value: "everyone", text: t("accessEveryone"), selected: entry.access === "everyone" ? "selected" : undefined }),
      ...players.map((p) =>
        el("option", {
          value: p.id,
          text: p.name,
          selected: entry.access === "assigned" && entry.ownerId === p.id ? "selected" : undefined,
        })
      ),
    ];
    row.appendChild(
      el(
        "select",
        {
          class: "access-select",
          title: t("accessLabel"),
          onchange: (e) => {
            const v = e.target.value;
            updateRoster((r) => {
              const target = r.find((x) => x.id === entry.id);
              if (!target) return;
              if (v === "gm") { target.access = "gm"; target.ownerId = null; }
              else if (v === "everyone") { target.access = "everyone"; target.ownerId = null; }
              else { target.access = "assigned"; target.ownerId = v; }
            });
          },
        },
        accessOptions
      )
    );

    const expanded = expandedRosterId === entry.id;
    row.appendChild(
      el("button", {
        class: "btn small ghost",
        text: expanded ? t("collapseCharacter") : t("expandCharacter"),
        onclick: () => {
          expandedRosterId = expanded ? null : entry.id;
          refreshTabContent();
        },
      })
    );
    row.appendChild(
      el("button", {
        class: "tag-remove",
        title: t("removeCharacter"),
        text: "✕",
        onclick: () => {
          if (!confirm(t("removeCharacterConfirm"))) return;
          updateRoster((r) => {
            const idx = r.findIndex((x) => x.id === entry.id);
            if (idx >= 0) r.splice(idx, 1);
          });
          delete roomMeta[characterKey(entry.id)];
          scheduleRoomSave(characterKey(entry.id));
          if (expandedRosterId === entry.id) expandedRosterId = null;
          refreshTabContent();
        },
      })
    );

    rowWrap.appendChild(row);

    if (expanded) {
      const { character: liveCharacter, save } = bindCharacter(entry.id);
      const editorBox = el("div", { class: "roster-editor" });
      editorBox.appendChild(renderCharacterSheet(liveCharacter, save));
      rowWrap.appendChild(editorBox);
    }

    wrap.appendChild(rowWrap);
  });

  return wrap;
}

// ---------- Settings tab (GM only — Theme categories) ----------

function renderSettingsTab() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("settingsTitle") }),
      el("button", {
        class: "btn small add-btn",
        text: t("addCategory"),
        onclick: () => {
          updateCampaign((c) => c.themeCategories.push(defaultCategory("", pickUnusedColor())));
          refreshTabContent();
        },
      }),
    ])
  );
  wrap.appendChild(el("div", { class: "hint" }, t("settingsHint")));

  const rows = el("div", { class: "list-rows" });
  getCampaign().themeCategories.forEach((cat) => {
    const row = el("div", { class: "category-row" });
    row.appendChild(
      renderColorSwatchPicker(cat.color, (c) => {
        updateCampaign((camp) => {
          const target = camp.themeCategories.find((x) => x.id === cat.id);
          if (target) target.color = c;
        });
        refreshTabContent();
      })
    );
    row.appendChild(
      el("input", {
        type: "text",
        class: "category-label-input",
        placeholder: t("categoryLabelPlaceholder"),
        value: cat.label,
        oninput: (e) => {
          updateCampaign((camp) => {
            const target = camp.themeCategories.find((x) => x.id === cat.id);
            if (target) target.label = e.target.value;
          });
        },
      })
    );
    row.appendChild(
      el("button", {
        class: "tag-remove",
        title: t("removeCategory"),
        text: "✕",
        onclick: () => {
          updateCampaign((camp) => {
            camp.themeCategories = camp.themeCategories.filter((c) => c.id !== cat.id);
          });
          refreshTabContent();
        },
      })
    );
    rows.appendChild(row);
  });
  wrap.appendChild(rows);

  return wrap;
}

// ---------- boot ----------

async function boot() {
  if (OBR.isAvailable) {
    backend = "obr";
    await new Promise((resolve) => OBR.onReady(resolve));
    selfId = OBR.player.id;
    selfName = await OBR.player.getName();
    selfRole = await OBR.player.getRole();

    OBR.player.onChange(async () => {
      selfName = await OBR.player.getName();
      selfRole = await OBR.player.getRole();
      renderApp();
    });

    OBR.party.onChange((players) => {
      partyPlayers = players;
      if (activeTab === "roster") refreshTabContent();
    });
    partyPlayers = await OBR.party.getPlayers();

    OBR.room.onMetadataChange((meta) => {
      const changed = JSON.stringify(meta) !== JSON.stringify(roomMeta);
      roomMeta = meta;
      if (changed) renderApp();
    });
  } else {
    backend = "standalone";
    selfId = "local";
    selfName = lang === "it" ? "Anteprima locale" : "Local preview";
    selfRole = "PLAYER";
  }

  await loadRoomMeta();
  renderApp();
}

boot();
