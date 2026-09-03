import OBR from "./obr-sdk.bundle.js";

const LANG_KEY = "mist-hero-sheet-lang";
const FONT_SCALE_KEY = "mist-hero-sheet-font-scale";
const ROLL_SOUND_MUTE_KEY = "mist-hero-sheet-roll-sound-muted";
const ROLL_LOG_PANEL_HIDDEN_KEY = "mist-hero-sheet-roll-log-hidden";
const COLOR_KEYS = ["amber", "teal", "violet", "rose", "sage"];

// Room metadata keys — everything lives in shared OBR room metadata now (not per-player
// metadata), so the GM can read/write any character, not just their own.
const ROOM_KEYS = {
  campaign: "com.mistengine.hero-sheet/campaign",
  company: "com.mistengine.hero-sheet/company",
  roster: "com.mistengine.hero-sheet/roster",
  rollLog: "com.mistengine.hero-sheet/rollLog",
  storyTags: "com.mistengine.hero-sheet/storyTags",
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

// The roll-log corner panel is, likewise, this same app loaded a third time — but as a tiny
// dedicated page with none of the character-sheet UI, opened automatically (not by the player
// clicking the toolbar icon) via manifest.background_url + OBR.popover.open (see background.html
// and rollDice() below). Query param recognized the same way as ?view=expanded above.
const ROLL_LOG_POPOVER_ID = "com.mistengine.hero-sheet/roll-log-popover";
const ROLL_LOG_MAX_ENTRIES = 50;
// Collapsed pill sized to match Owlbear's own round toolbar/HUD buttons (32px, via .roll-log-pill
// in style.css), not the sheet's own larger icon buttons — this is the one button that floats
// directly over the game table. The popover box itself is a few px larger than the visible pill
// (same 4px-per-side margin as the original 56/48 pair) so the pill's drop shadow has room to
// render instead of being clipped at the popover's exact edge.
//
// Owlbear's own bottom-right corner already has a native control (the scene/map toggle) sitting
// right at the edge, so the widget needs to clear it vertically. A uniform OBR.popover.open()
// marginThreshold (tried first) pushed every edge in by the same 56px, which read as "a little
// off" from the right; going fully flush-right instead (tried next) read as "way too far right" —
// so the right-side gap is now deliberately half of the vertical one, not zero. Both gaps are
// created inside the widget's own page (see body.roll-log-view's padding in style.css, which must
// match these numbers) rather than via the popover API's own margin option, so each axis can be
// tuned independently instead of moving together.
const ROLL_LOG_BASE_BOTTOM_CLEARANCE = 56;
const ROLL_LOG_RIGHT_CLEARANCE = 28;
// Even that tuned 56px still grazed Owlbear's own map-toggle button on some screens — a fixed
// pixel count can't scale with how tall the actual game window is. rollLogExtraLift adds a
// further lift on top of the base clearance, computed once at boot (see computeRollLogExtraLift,
// near boot()) as a fraction of the real game-window height (OBR.viewport.getHeight()) rather
// than another hardcoded number, so the gap holds up across very different screen sizes. Starts
// at 0 (i.e. just the base clearance) until boot() resolves the real value, so the widget still
// has a sensible size for the brief instant before that async call returns.
const ROLL_LOG_EXTRA_LIFT_FRACTION = 0.05;
let rollLogExtraLift = 0;
function rollLogBottomClearance() {
  return ROLL_LOG_BASE_BOTTOM_CLEARANCE + rollLogExtraLift;
}
function rollLogCollapsedSize() {
  return { width: 40 + ROLL_LOG_RIGHT_CLEARANCE, height: 40 + rollLogBottomClearance() };
}
// Expanded panel width is the CSS .roll-log-panel max-width (280px) plus a fixed margin — kept
// 15% wider than the original 280/300 pair at the user's request.
//
// The panel is built from 3 stacked pieces — see renderRollLogPanel(): a fixed header, the Scene
// Tags glance (grows with content, see rollLogSceneExtraHeight below, up to half the real
// game-window height), and a "Last Roll" block (a small fixed-size header + just the single
// newest roll, with a History toggle that reveals the rest as an extra scrollable block). Scene
// Tags are "the heart of gameplay" per the user, so they get first claim on space and the most
// generous cap of the three.
const ROLL_LOG_HEADER_HEIGHT = 48; // .roll-log-header, measured
const ROLL_LOG_LAST_SECTION_HEIGHT = 92; // .roll-log-last: its own header row + one entry + padding, measured
let rollLogHistoryExpanded = false; // per-viewer scratch UI state, not synced — same as rollLogExpanded

// History is capped at a flat height (unlike Scene Tags' "half the panel" rule below) since it's
// opt-in — the user explicitly asked for it, so it's fine for it to just scroll within a modest
// budget rather than reshaping the whole panel further.
const ROLL_LOG_HISTORY_ROW_HEIGHT = 46;
const ROLL_LOG_HISTORY_PADDING = 16;
const ROLL_LOG_HISTORY_MAX_HEIGHT = 220;
function rollLogHistoryExtraHeight() {
  if (!rollLogHistoryExpanded) return 0;
  // The newest entry already shows in the "Last Roll" block below, so History only needs to hold
  // everything else.
  const count = Math.max(0, getRollLog().length - 1);
  if (count === 0) return 0;
  return Math.min(ROLL_LOG_HISTORY_MAX_HEIGHT, count * ROLL_LOG_HISTORY_ROW_HEIGHT + ROLL_LOG_HISTORY_PADDING);
}

// Everything in the panel EXCEPT Scene Tags — used for the panel's total target height below.
function rollLogOtherHeight() {
  return ROLL_LOG_HEADER_HEIGHT + ROLL_LOG_LAST_SECTION_HEIGHT + rollLogHistoryExtraHeight();
}

// Half the real game-window HEIGHT, per explicit request — how tall the Scene Tags block is
// allowed to grow (from 0, as tags are added, auto-updating) before it scrolls internally instead
// of continuing to grow. Computed once at boot (see boot()'s viewportHeight fetch, shared with
// rollLogExtraLift above) since it needs an actual OBR.viewport.getHeight() round trip. An earlier
// version derived this cap from the rest of the panel's OWN height instead of the real screen —
// that seemed clever (it made "half the panel" self-enforcing) but was wrong in practice: with a
// small Last Roll block and no History open, "the rest of the panel" is tiny, so the cap ended up
// far smaller than the user's actual intent (half the SCREEN), causing a scrollbar to appear with
// only a handful of tags.
let rollLogSceneMaxHeight = 260; // sensible default for the instant before boot() resolves the real height
function rollLogSceneExtraHeight() {
  const storyTags = getStoryTags();
  const count = storyTags.tags.length + storyTags.statuses.length;
  if (count === 0) return 0;
  const SCENE_HEADER_HEIGHT = 28; // .roll-log-subheader (the "Scene Tags" title bar)
  const SCENE_ROW_HEIGHT = 28; // one compact chip/card row + its gap
  const SCENE_BLOCK_PADDING = 8; // .roll-log-scene-content's own top/bottom padding
  return Math.min(rollLogSceneMaxHeight, SCENE_HEADER_HEIGHT + count * SCENE_ROW_HEIGHT + SCENE_BLOCK_PADDING);
}
// The panel's own target height, NOT counting rollLogBottomClearance() (that's separate page
// padding below the panel, not part of its box) — used ONLY to decide how tall a popover box to
// ask Owlbear for (rollLogExpandedSize() below), not as a source of visual truth for CSS anymore.
// An earlier version also published this as a CSS custom property so .roll-log-panel's own
// max-height could track it exactly — that assumed Owlbear always honors the requested height
// precisely, which doesn't hold up in a real room (the granted popover box can come back shorter,
// or larger, than asked for reasons outside this app's control). CSS now trusts the popover's own
// real rendered size directly (100vh/50vh units, see .roll-log-panel/.roll-log-scene in style.css)
// instead of a JS pre-estimate — this JS number only needs to be a reasonable ballpark for the
// initial request, not pixel-perfect.
function rollLogPanelTargetHeight() {
  return rollLogOtherHeight() + rollLogSceneExtraHeight();
}
function rollLogExpandedSize() {
  return { width: 342 + ROLL_LOG_RIGHT_CLEARANCE, height: rollLogPanelTargetHeight() + rollLogBottomClearance() };
}
const isRollLogView = new URLSearchParams(window.location.search).get("view") === "rolllog";
// Set on the URL only by openRollLogPopover()'s deliberate "activate" action below — background.html's
// own ambient auto-open (on room join) omits this, so a fresh connection still starts as the small
// collapsed pill, not the full log, which stays the unobtrusive default.
const rollLogOpensExpanded = new URLSearchParams(window.location.search).get("open") === "expanded";
if (isRollLogView) {
  // This page is just the floating dice pill/panel, not the parchment character sheet — strip
  // the sheet's page background/padding so only the widget itself shows over the game table.
  document.documentElement.classList.add("roll-log-view");
  document.body.classList.add("roll-log-view");
}

// ---------- localization ----------

const LABELS = {
  en: {
    standaloneBanner: "Local preview mode (not connected to Owlbear Rodeo) — data is saved only in this browser.",
    footer: "Mist Engine — Hero Sheet · built for Owlbear Rodeo",
    tabSheet: "Hero",
    tabCompany: "Company",
    tabScene: "Scene",
    tabRoster: "Roster",
    tabSettings: "Settings",
    playerLabel: "Player: ",
    roleNarrator: "Narrator",
    langToggleTitle: "Switch to Italian",
    fontDecreaseTitle: "Decrease text size",
    fontIncreaseTitle: "Increase text size",
    expandViewTitle: "Open larger view",
    collapseViewTitle: "Close larger view",
    hideRollLogPanelTitle: "Hide roll log widget",
    showRollLogPanelTitle: "Show roll log widget",
    confirmCancel: "Cancel",
    confirmDelete: "Delete",

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
    removeTagTitle: "Remove tag",
    removeTagConfirm: "Remove this tag?",
    showMore: "Show more",
    showLess: "Show less",
    removeTheme: "Delete",
    removeThemeConfirm: "Remove this Theme?",
    flipTitle: "Flip the card",
    tracksTitle: "Tracks",
    trackLabelAbandon: "Abandon",
    trackLabelImprove: "Improve",
    trackLabelAdvance: "Advance",
    defaultTrackLabel: "Track",
    trackLabelsSettingsTitle: "Track Names",
    trackLabelsSettingsHint: "Define the names for the 3 progress tracks on the back of every Theme card (e.g. Abandon / Improve / Advance) — the same 3 names apply to every character's Themes and the Company Theme. Only you (the GM) can edit these.",
    trackLabelPlaceholder: "Track name",
    specialLabel: "Special Upgrades",
    specialPlaceholder: "Upgrades unlocked for this Theme…",
    backpackTitle: "Backpack",
    addItem: "+ Item",
    itemPlaceholder: "item…",
    removeItem: "Remove item",
    removeItemConfirm: "Remove this item?",
    activeTagsTitle: "Active Tags",
    addActiveTag: "+ Tag",
    addStatus: "+ Status",
    activeTagPlaceholder: "tag",
    statusPlaceholder: "status",
    removeActiveTag: "Remove tag",
    removeActiveTagConfirm: "Remove this tag?",
    removeStatus: "Remove status",
    removeStatusConfirm: "Remove this status?",
    sceneTitle: "Story Tags & Statuses",
    sceneHintGm: "Give the scene tags and statuses of its own — an enemy's wound, a dim-light area. Players tick these from their own Active Tags section and choose their own +/-.",
    sceneTagsTitle: "Scene Tags",
    sceneEmpty: "Nothing active in the scene right now.",
    addStoryTag: "+ Tag",
    addStoryStatus: "+ Status",
    storyTagPlaceholder: "story tag",
    storyStatusPlaceholder: "story status",
    removeStoryTag: "Remove story tag",
    removeStoryTagConfirm: "Remove this story tag?",
    removeStoryStatus: "Remove story status",
    removeStoryStatusConfirm: "Remove this story status?",
    tickStoryTagTitle: "Count toward Total Power (+1, or -1 if this tag hurts)",
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
    tagColorLabel: "Tag color",
    statusColorLabel: "Status color",
    storyTagColorLabel: "Story Tag color",
    storyStatusColorLabel: "Story Status color",

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

    tickPowerTitle: "Count toward Total Power",
    tickWeaknessTitle: "Count toward Total Power (-1)",
    tickActiveTagTitle: "Count toward Total Power (+1, or -1 if this tag hurts)",
    tickStatusPositiveTitle: "Count toward Total Power (best positive Status)",
    tickStatusNegativeTitle: "Count toward Total Power (worst negative Status)",
    statusPolarityPositiveTitle: "Helps the roll (click to make it hurt instead)",
    statusPolarityNegativeTitle: "Hurts the roll (click to make it help instead)",
    tickItemTitle: "Count toward Total Power",
    burnItemTitle: "Burn this item (+3 instead of +1)",
    restoreItemTitle: "Restore this item",
    totalPowerTitle: "Total Power for the upcoming roll",
    totalPowerLabel: "Power",
    powerModifierTitle: "Manual modifier (Favored/Disfavored, GM-granted tags…)",
    resetPowerTitle: "Reset Total Power tally",
    rollButtonTitle: "Roll 2d6 + Total Power",
    rollLogTitle: "Scene",
    lastRollTitle: "Last Roll",
    showHistoryTitle: "Show roll history",
    hideHistoryTitle: "Hide roll history",
    moreSceneTagsTitle: "More Scene Tags below — scroll to see them",
    rollLogEmpty: "No rolls yet.",
    clearRollLogTitle: "Clear roll history",
    clearRollLogConfirm: "Clear the roll history for everyone? This can't be undone.",
    collapseRollLogTitle: "Collapse",
    expandRollLogTitle: "Show roll log",
    rollOutcomeSuccess: "Success (10+)",
    rollOutcomeMixed: "Mixed success (7-9)",
    rollOutcomeFailure: "Failure (6-)",
    muteRollSoundTitle: "Mute dice sound (just for you)",
    unmuteRollSoundTitle: "Unmute dice sound (just for you)",
  },
  it: {
    standaloneBanner: "Modalità anteprima locale (non collegata a Owlbear Rodeo) — i dati sono salvati solo in questo browser.",
    footer: "Mist Engine — Scheda Eroe · creata per Owlbear Rodeo",
    tabSheet: "Eroe",
    tabCompany: "Compagnia",
    tabScene: "Scena",
    tabRoster: "Personaggi",
    tabSettings: "Impostazioni",
    playerLabel: "Giocatore: ",
    roleNarrator: "Narratore",
    langToggleTitle: "Switch to English",
    fontDecreaseTitle: "Riduci dimensione testo",
    fontIncreaseTitle: "Aumenta dimensione testo",
    expandViewTitle: "Apri vista grande",
    collapseViewTitle: "Chiudi vista grande",
    hideRollLogPanelTitle: "Nascondi il widget dei tiri",
    showRollLogPanelTitle: "Mostra il widget dei tiri",
    confirmCancel: "Annulla",
    confirmDelete: "Elimina",

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
    removeTagTitle: "Rimuovi attributo",
    removeTagConfirm: "Rimuovere questo attributo?",
    showMore: "Mostra altro",
    showLess: "Mostra meno",
    removeTheme: "Elimina",
    removeThemeConfirm: "Rimuovere questo Tema?",
    flipTitle: "Gira la carta",
    tracksTitle: "Tracce",
    trackLabelAbandon: "Abbandono",
    trackLabelImprove: "Miglioria",
    trackLabelAdvance: "Avanzamento",
    defaultTrackLabel: "Traccia",
    trackLabelsSettingsTitle: "Nomi delle Tracce",
    trackLabelsSettingsHint: "Definisci i nomi delle 3 tracce di progresso sul retro di ogni carta Tema (es. Abbandono / Miglioria / Avanzamento) — gli stessi 3 nomi si applicano ai Temi di ogni personaggio e al Tema di Compagnia. Questa scheda è modificabile solo da te (il Narratore).",
    trackLabelPlaceholder: "Nome traccia",
    specialLabel: "Miglioramenti Speciali",
    specialPlaceholder: "Miglioramenti sbloccati per questo Tema…",
    backpackTitle: "Zaino",
    addItem: "+ Oggetto",
    itemPlaceholder: "oggetto…",
    removeItem: "Rimuovi oggetto",
    removeItemConfirm: "Rimuovere questo oggetto?",
    activeTagsTitle: "Attributi Attivi",
    addActiveTag: "+ Attributo",
    addStatus: "+ Stato",
    activeTagPlaceholder: "attributo",
    statusPlaceholder: "stato",
    removeActiveTag: "Rimuovi attributo",
    removeActiveTagConfirm: "Rimuovere questo attributo?",
    removeStatus: "Rimuovi stato",
    removeStatusConfirm: "Rimuovere questo stato?",
    sceneTitle: "Attributi e Stati della Scena",
    sceneHintGm: "Dai alla scena attributi e stati propri — la ferita di un nemico, una zona in penombra. I giocatori li selezionano dalla propria sezione Attributi Attivi e scelgono da soli il proprio +/-.",
    sceneTagsTitle: "Attributi di Scena",
    sceneEmpty: "Nessun elemento attivo nella scena al momento.",
    addStoryTag: "+ Attributo",
    addStoryStatus: "+ Stato",
    storyTagPlaceholder: "attributo di scena",
    storyStatusPlaceholder: "stato di scena",
    removeStoryTag: "Rimuovi attributo di scena",
    removeStoryTagConfirm: "Rimuovere questo attributo di scena?",
    removeStoryStatus: "Rimuovi stato di scena",
    removeStoryStatusConfirm: "Rimuovere questo stato di scena?",
    tickStoryTagTitle: "Conta per il Potere Totale (+1, o -1 se questo attributo ostacola)",
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
    tagColorLabel: "Colore Attributo",
    statusColorLabel: "Colore Stato",
    storyTagColorLabel: "Colore Attributo di Scena",
    storyStatusColorLabel: "Colore Stato di Scena",

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

    tickPowerTitle: "Conta per il Potere Totale",
    tickWeaknessTitle: "Conta per il Potere Totale (-1)",
    tickActiveTagTitle: "Conta per il Potere Totale (+1, o -1 se questo attributo ostacola)",
    tickStatusPositiveTitle: "Conta per il Potere Totale (miglior Stato positivo)",
    tickStatusNegativeTitle: "Conta per il Potere Totale (peggior Stato negativo)",
    statusPolarityPositiveTitle: "Aiuta il tiro (clicca per farlo ostacolare)",
    statusPolarityNegativeTitle: "Ostacola il tiro (clicca per farlo aiutare)",
    tickItemTitle: "Conta per il Potere Totale",
    burnItemTitle: "Brucia questo oggetto (+3 invece di +1)",
    restoreItemTitle: "Ripristina questo oggetto",
    totalPowerTitle: "Potere Totale per il prossimo tiro",
    totalPowerLabel: "Potere",
    powerModifierTitle: "Modificatore manuale (Favorito/Sfavorito, attributi concessi dal Narratore…)",
    resetPowerTitle: "Azzera il conteggio del Potere",
    rollButtonTitle: "Tira 2d6 + Potere Totale",
    rollLogTitle: "Scena",
    lastRollTitle: "Ultimo Tiro",
    showHistoryTitle: "Mostra la cronologia dei tiri",
    hideHistoryTitle: "Nascondi la cronologia dei tiri",
    moreSceneTagsTitle: "Altri Attributi di Scena più sotto — scorri per vederli",
    rollLogEmpty: "Nessun tiro ancora.",
    clearRollLogTitle: "Cancella la cronologia dei tiri",
    clearRollLogConfirm: "Cancellare la cronologia dei tiri per tutti? Non può essere annullato.",
    collapseRollLogTitle: "Comprimi",
    expandRollLogTitle: "Mostra il registro dei tiri",
    rollOutcomeSuccess: "Successo pieno (10+)",
    rollOutcomeMixed: "Successo parziale (7-9)",
    rollOutcomeFailure: "Fallimento (6-)",
    muteRollSoundTitle: "Disattiva il suono dei tiri (solo per te)",
    unmuteRollSoundTitle: "Riattiva il suono dei tiri (solo per te)",
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

// The roll-log corner popover (?view=rolllog, see background.html) is a genuinely separate page
// in real Owlbear, not just a different render branch of this one — so toggling the language from
// the main sheet's topbar only updates ITS OWN page via the renderApp() call in setLang() above;
// the popover's `lang` was still whatever it loaded with. Same origin, though, so a localStorage
// write in one window fires a "storage" event in every OTHER same-origin window/page — exactly
// what's needed to keep the popover (and the expanded view, if that's open too) in sync live,
// with no round trip through room metadata required.
window.addEventListener("storage", (e) => {
  if (e.key === LANG_KEY) {
    lang = e.newValue === "it" ? "it" : "en";
    renderApp();
  }
});

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

// ---------- dice roll sound ----------
// The sound itself always plays for every connected client whenever anyone rolls (see rollDice()
// and the OBR.room.onMetadataChange listener in boot()) — that's the point, the whole table
// should hear it, not just the roller. This section is only the personal on/off switch: a
// per-browser preference, "everyone picks their own" like fontScaleIndex above, so a player who
// finds it annoying can silence it for themselves without asking the GM to turn it off for
// everyone.
let rollSoundMuted = localStorage.getItem(ROLL_SOUND_MUTE_KEY) === "1";

function setRollSoundMuted(muted) {
  rollSoundMuted = muted;
  localStorage.setItem(ROLL_SOUND_MUTE_KEY, muted ? "1" : "0");
}

// The mute button only exists on the roll-log corner popover's own page (?view=rolllog) — but
// the roll BUTTON a player actually clicks lives on a completely different page (the main sheet,
// opened separately from the toolbar). Those are two independent script instances, each with its
// own module-level rollSoundMuted read once at load time — muting on one page was silently never
// reaching the other, so a player's own rolls kept playing sound even after they'd hit mute. A
// "storage" event fires in every OTHER same-origin page when one of them writes to localStorage
// (never in the page that made the write, which already updated its own variable above), so this
// is what actually keeps every open copy of this extension in sync live.
window.addEventListener("storage", (e) => {
  if (e.key !== ROLL_SOUND_MUTE_KEY) return;
  rollSoundMuted = e.newValue === "1";
  // Only the corner widget's own header displays this state — refresh it if this particular page
  // happens to be showing one (the dedicated roll-log view, or standalone's embedded overlay).
  if (isRollLogView) renderApp();
  else if (backend === "standalone") refreshRollLogWidget();
});

// ---------- roll log widget visibility (per-browser, everyone picks their own) ----------
// background.html opens the corner widget automatically for every connected player, docked just
// above Owlbear's own scene/map toggle — but that spot isn't free real estate for everyone (some
// tables run other HUD extensions there too), so this is a personal show/hide switch, toggled
// from the main sheet's topbar (see renderTopbar()), independent of the GM and of what anyone
// else at the table sees. Real Owlbear lets any page belonging to this extension open or close a
// popover it already knows the id of — not just the page that originally opened it (the roll-log
// panel itself already proves this, resizing the same popover via setWidth/setHeight from ITS OWN
// page in setRollLogPopoverSize below) — so the topbar button can call OBR.popover.open()/close()
// directly, with no need to route the request through background.html. background.html only
// needs to check this same flag once, before its own initial open() call, so a player who hid the
// widget doesn't have it silently reappear on their next reconnect.
let rollLogPanelHidden = localStorage.getItem(ROLL_LOG_PANEL_HIDDEN_KEY) === "1";

function openRollLogPopover() {
  if (backend !== "obr") return;
  // Absolute URL for the same reason as openExpandedView()/background.html: Owlbear resolves a
  // relative "url" by concatenating its own origin with no separator, which breaks on a site
  // hosted below the domain root (e.g. a GitHub Pages project repo). "open=expanded" tells the
  // freshly-loaded roll-log page to start already showing the log itself, not just the small
  // pill — the player explicitly asked to see it by clicking this button, so it should open
  // straight to the useful view instead of requiring a second click on the pill to expand it.
  const url = window.location.origin + window.location.pathname + "?view=rolllog&open=expanded";
  const size = rollLogExpandedSize();
  OBR.popover.open({
    id: ROLL_LOG_POPOVER_ID,
    url,
    width: size.width,
    height: size.height,
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    disableClickAway: true,
    hidePaper: true,
    marginThreshold: 0,
  });
  // This id is very often already open at this point — background.html auto-opens it (collapsed)
  // for every connected player the moment they join, and this "activate" action only runs when a
  // player re-shows a widget they'd previously hidden, at which point it's genuinely closed, but
  // also whenever they just want the collapsed pill to jump straight to the full log. The
  // width/height passed to open() above is this codebase's only sizing call that's never actually
  // been verified against a real, already-open popover (every other resize — collapse/expand via
  // the pill, the map-toggle clearance passes — goes through setWidth/setHeight, and THAT path has
  // repeatedly been confirmed to correctly resize AND reposition an existing popover). Re-issuing
  // the exact same size through that proven mechanism right after open() is a no-op if open()
  // already got it right, and a real fix if it didn't — cheap insurance against exactly the
  // "top of the panel is clipped" failure mode reported after using this button.
  OBR.popover.setWidth(ROLL_LOG_POPOVER_ID, size.width);
  OBR.popover.setHeight(ROLL_LOG_POPOVER_ID, size.height);
}

function closeRollLogPopover() {
  if (backend !== "obr") return;
  OBR.popover.close(ROLL_LOG_POPOVER_ID);
}

function setRollLogPanelHidden(hidden) {
  rollLogPanelHidden = hidden;
  localStorage.setItem(ROLL_LOG_PANEL_HIDDEN_KEY, hidden ? "1" : "0");
  if (hidden) {
    closeRollLogPopover();
  } else {
    openRollLogPopover();
    // Standalone's embedded overlay is rendered by this same script instance (unlike the real
    // popover, which loads ?view=rolllog&open=expanded fresh — see openRollLogPopover) — so there's
    // no URL to pass the "start expanded" request through. Setting the shared flag directly here
    // gets the same "activating this shows the log itself, not just the pill" result in local
    // preview too.
    rollLogExpanded = true;
  }
  renderApp();
}

// Keeps a second open main-sheet tab's topbar button (and standalone's embedded overlay) in sync
// if the preference changes elsewhere — mirrors the sound-mute listener above. background.html
// doesn't load this script at all (see its own comment on why), so it can't hear this event; it
// only ever reads the flag once, at its own boot, which is enough since the click that changes it
// already opens/closes the real popover directly, above.
window.addEventListener("storage", (e) => {
  if (e.key !== ROLL_LOG_PANEL_HIDDEN_KEY) return;
  rollLogPanelHidden = e.newValue === "1";
  if (!isRollLogView) renderApp();
});

let diceAudioCtx = null;
function getDiceAudioCtx() {
  if (diceAudioCtx) return diceAudioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  diceAudioCtx = Ctx ? new Ctx() : null;
  return diceAudioCtx;
}

// Synthesizes a short dice-clatter sound (a handful of filtered noise bursts with decaying
// pitch/volume, like a few dice hitting a table) with the Web Audio API instead of shipping an
// audio file — keeps the extension a plain dependency-free static site and sidesteps any
// licensing question over a found sound effect.
function playDiceRollSound() {
  if (rollSoundMuted) return;
  try {
    const ctx = getDiceAudioCtx();
    if (!ctx) return;
    // Browsers suspend a freshly-created AudioContext until the page/frame has seen a user
    // gesture. resume() is a no-op once that's already happened, and this call is harmless (just
    // silently ineffective) if it hasn't — the very next gesture on this popover (e.g. clicking
    // the pill to expand it) unblocks it for every roll after that.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const clackTimes = [0, 0.07, 0.13, 0.2, 0.29];
    clackTimes.forEach((offset, i) => {
      const dur = 0.055;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let n = 0; n < bufferSize; n++) {
        data[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / bufferSize, 2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400 - i * 160;
      filter.Q.value = 1.1;
      const gain = ctx.createGain();
      const startAt = now + offset;
      gain.gain.setValueAtTime(0.32 - i * 0.02, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(startAt);
      noise.stop(startAt + dur + 0.01);
    });
  } catch (err) {
    // Fails silently — worst case a roll is quiet instead of breaking the roll itself.
  }
}

// ---------- expanded view (Owlbear Modal / popup window) ----------

function openExpandedView() {
  if (backend === "obr") {
    // Build an already-absolute URL ourselves: Owlbear's SDK resolves a relative "url" by
    // concatenating its own origin with the string with NO separator inserted, which breaks
    // on any site not hosted at the domain root (e.g. a GitHub Pages project repo). Passing
    // a full "https://…" URL sidesteps that entirely, and works regardless of where this is
    // deployed.
    const url = window.location.origin + window.location.pathname + "?view=expanded";
    // fullScreen instead of a fixed pixel width/height: the Themes grid already lays 4 cards
    // out side-by-side once there's roughly 1000px of width to work with (auto-fit grid,
    // minmax(230px,1fr)) — a fixed 1180px modal covers that on a big monitor but leaves no
    // margin on a smaller one. fullScreen always gives the grid the whole window, so 4 Theme
    // cards show in a row regardless of the player's screen size.
    OBR.modal.open({ id: MODAL_ID, url, fullScreen: true });
  } else {
    const w = Math.max(1180, window.screen.availWidth || 1180);
    const h = Math.max(820, window.screen.availHeight || 820);
    window.open(window.location.pathname + "?view=expanded", "mist-hero-sheet-expanded", `width=${w},height=${h}`);
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

function trashIcon() {
  return svgIcon(
    [
      ["polyline", { points: "3 6 5 6 21 6" }],
      ["path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }],
      ["path", { d: "M10 11v6" }],
      ["path", { d: "M14 11v6" }],
      ["path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }],
    ],
    { size: 14, strokeWidth: 2 }
  );
}

// Three diagonal claw-scratch marks — the Legend in the Mist book's Power tag icon, used in
// place of a generic "sword" glyph for an unburned Power tag.
function clawIcon() {
  return svgIcon(
    [
      ["line", { x1: "5", y1: "19", x2: "9", y2: "5" }],
      ["line", { x1: "10", y1: "19", x2: "13", y2: "5" }],
      ["line", { x1: "15", y1: "19", x2: "18", y2: "5" }],
    ],
    { size: 13, strokeWidth: 2.3 }
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

// A plain clock face — the roll-log widget's History toggle (show/hide older rolls). Picked over
// a clock-with-rewind-arrow variant specifically to avoid looking like resetIcon() below, which
// already owns that "arc + arrow" shape for a very different action (Reset Total Power).
function clockIcon() {
  return svgIcon(
    [
      ["circle", { cx: "12", cy: "12", r: "9" }],
      ["polyline", { points: "12 7 12 12 15.5 14" }],
    ],
    { size: 14, strokeWidth: 2.2 }
  );
}

// A single down chevron — the Scene Tags "more below, scroll for it" indicator. Deliberately a
// single chevron, not chevronsDownIcon()'s double one (already used elsewhere for a "show more"
// button), since this isn't a button at all — just a passive hint, and reusing that exact shape
// for a non-interactive element risked reading as another clickable "show more" affordance.
function chevronDownIcon() {
  return svgIcon([["polyline", { points: "5 8 12 15 19 8" }]], { size: 13, strokeWidth: 2.2 });
}

// Single counter-clockwise arrow — the Total Power "Reset" button (distinct from flipIcon's
// two-arrow loop, which means something else already: flipping a Theme card).
function resetIcon() {
  return svgIcon(
    [
      ["path", { d: "M3 12a9 9 0 1 0 3-6.7" }],
      ["polyline", { points: "3 3 3 8 8 8" }],
    ],
    { size: 14, strokeWidth: 2.2 }
  );
}

// Small square tick control — "count this toward the Total Power tally for the upcoming roll."
// Same interaction/visual language as Backpack's .check-toggle, just usable anywhere (tag pills,
// Active Tags, Statuses, the Theme title pill) via its own class.
function tickToggle(checked, title, onclick) {
  return el("button", {
    class: "tick-toggle" + (checked ? " checked" : ""),
    title,
    "aria-label": title,
    onclick,
  });
}

// A six-sided die face (rounded square + 5 pips) — the roll button, and the roll-log panel's
// collapsed pill icon.
function diceIcon(size) {
  return svgIcon(
    [
      ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "4" }],
      ["circle", { cx: "8", cy: "8", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "16", cy: "8", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "12", cy: "12", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "8", cy: "16", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "16", cy: "16", r: "1.5", fill: "currentColor", stroke: "none" }],
    ],
    { size: size || 15, strokeWidth: 2 }
  );
}

// Same dice glyph plus a diagonal slash — the topbar's personal show/hide toggle for the corner
// roll-log widget (see rollLogPanelHidden), shown when the widget is currently hidden.
function diceOffIcon(size) {
  return svgIcon(
    [
      ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "4" }],
      ["circle", { cx: "8", cy: "8", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "16", cy: "8", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "12", cy: "12", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "8", cy: "16", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["circle", { cx: "16", cy: "16", r: "1.5", fill: "currentColor", stroke: "none" }],
      ["line", { x1: "2", y1: "2", x2: "22", y2: "22" }],
    ],
    { size: size || 15, strokeWidth: 2 }
  );
}

// Speaker glyphs — the roll-log panel's personal mute toggle (see rollSoundMuted). Solid speaker
// body plus either two sound-wave arcs (on) or an X (muted).
function soundOnIcon() {
  return svgIcon(
    [
      ["path", { d: "M4 9v6h4l5 5V4L8 9H4z", fill: "currentColor", stroke: "none" }],
      ["path", { d: "M16 8.5a5 5 0 0 1 0 7" }],
      ["path", { d: "M18.5 6a8.5 8.5 0 0 1 0 12" }],
    ],
    { size: 14, strokeWidth: 2 }
  );
}

function soundOffIcon() {
  return svgIcon(
    [
      ["path", { d: "M4 9v6h4l5 5V4L8 9H4z", fill: "currentColor", stroke: "none" }],
      ["line", { x1: "16", y1: "9", x2: "22", y2: "15" }],
      ["line", { x1: "22", y1: "9", x2: "16", y2: "15" }],
    ],
    { size: 14, strokeWidth: 2 }
  );
}

// An open book — used for the Background toggle button. Tried a rolled-scroll glyph first, but
// at icon size it read as an ambiguous blob rather than "story"; an open book reads immediately
// even small. Two curved-spine pages (the well-known "book-open" glyph shape).
function bookIcon() {
  return svgIcon(
    [
      ["path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" }],
      ["path", { d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" }],
    ],
    { size: 15, strokeWidth: 2 }
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
const expandedThemeExtraIds = new Set(); // which Theme cards have their "Show more" (Type/Quest) open
let partyPlayers = []; // [{id, name, role, metadata}] — everyone except self

// ---------- Total Power tally (scratch state for "the upcoming roll", not synced) ----------
// Ticking a tag/status to count it toward Potere is a per-viewer, per-roll working note, not
// real character data — like flippedThemeIds/expandedThemeExtraIds below, it resets on reload
// and is never written to room metadata. Only tag.burned and a Status's polarity are persisted.
// Tag/theme/status ids are already globally unique (uid()), so a plain Set of ticked ids is safe
// even with multiple characters open at once (e.g. GM's Roster + a player's own Hero tab) — the
// Reset button just needs to delete the specific ids belonging to the character it was clicked
// on (see resetTotalPower()), not the whole Set.
const rollSelection = new Set();
const rollModifiers = new Map(); // characterId -> manual +/- modifier, default 0

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

// Structural equality for plain JSON-shaped data (objects/arrays/primitives), independent of
// object key insertion order. Used instead of comparing JSON.stringify() output when deciding
// whether an incoming room-metadata snapshot actually differs from what we already have — two
// semantically identical objects can still stringify to different text if their keys were built
// up in a different order (e.g. a freshly round-tripped object from OBR vs. one this client just
// rebuilt locally), and a false "changed" there was silently forcing a full re-render — see the
// onMetadataChange handler in boot() for why that mattered enough to fix.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// ---------- in-app confirm dialog ----------
// Deliberately NOT the browser's native confirm(): Chrome (and others) let a user permanently
// silence a page's dialogs via a "Don't allow this page to create additional dialogs"
// checkbox, after which confirm() returns false instantly with no dialog shown at all — which
// would silently turn every "if (!confirm(...)) return" delete button into a dead button until
// the page reloads. This renders our own overlay instead, so a delete can never be blocked by
// browser dialog settings.
let activeConfirmClose = null;

// Closes any currently-open confirm dialog without running its onConfirm. Called at the top of
// every full renderApp() pass: a full re-render (triggered by a remote room-metadata change,
// player.onChange, a font/lang toggle, etc. while the dialog was open) would otherwise leave a
// "ghost" dialog on screen whose Delete button still closes over data from before the re-render
// — clicking it would silently do nothing (see bindCharacter()/bindCompany() for the other half
// of this fix). Dropping the stale dialog instead makes the failure visible: it just closes, so
// the user re-opens it and the retry works against current data.
function closeConfirmDialog() {
  if (activeConfirmClose) activeConfirmClose();
}

function showConfirmDialog(message, onConfirm) {
  closeConfirmDialog(); // never stack more than one confirm dialog at once

  const overlay = el("div", { class: "confirm-overlay" });
  const box = el("div", { class: "confirm-box" });
  box.appendChild(el("div", { class: "confirm-message", text: message }));
  const actions = el("div", { class: "confirm-actions" });

  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    if (activeConfirmClose === close) activeConfirmClose = null;
  }
  activeConfirmClose = close;

  actions.appendChild(el("button", { class: "btn ghost", text: t("confirmCancel"), onclick: close }));
  actions.appendChild(
    el("button", {
      class: "btn danger",
      text: t("confirmDelete"),
      onclick: () => {
        close();
        onConfirm();
      },
    })
  );
  box.appendChild(actions);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

// ---------- room metadata store ----------
// Everything shared (campaign settings, the Company Theme, the character roster index, and
// every individual character's sheet) lives in one flat OBR room-metadata object, one key
// per piece, so two people editing different things never clobber each other.

let roomMeta = {};
const roomSaveTimers = new Map();

// A remote metadata change (see boot()'s OBR.room.onMetadataChange) triggers a full renderApp(),
// which rebuilds every DOM node — including whatever text input the player currently has focus
// in. That's what made a Settings text field (or any other synced text field) feel like it
// "deactivated" after a single keystroke: the debounced save for that keystroke round-trips back
// as a metadata-change event a couple hundred ms later, and the resulting re-render yanks focus
// out from under the very field the player is still typing in. Rather than rendering immediately
// on every metadata change, defer it while a text input/textarea is focused, and catch up the
// instant that field loses focus — the player's own edit is already reflected locally (roomMeta
// is updated either way), so nothing is lost by waiting to redraw.
let pendingRenderAfterEdit = false;

function isEditableFocused() {
  const ae = document.activeElement;
  return !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
}

document.addEventListener("focusout", () => {
  if (!pendingRenderAfterEdit) return;
  pendingRenderAfterEdit = false;
  // The field that just blurred already has whatever the player typed; a fresh render here only
  // ever adds information (a remote change that arrived while they were busy), never removes it.
  renderApp();
});

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
    // Tag/Status boxes are colored independently from Theme categories — brown-ish amber for
    // Tags, green sage for Statuses by default, echoing Otherscape/Legend in the Mist's own
    // palette, but the GM can repick either from the same 5-color set used for categories.
    tagColor: "amber",
    statusColor: "sage",
    // Story Tags/Statuses (GM-authored, scene-wide — see the Scene tab) get their own pair of
    // colors, distinct from the personal Active Tag/Status pair above, so a glance at a chip's
    // color alone tells you whether it's "mine" or "the Narrator's scene."
    storyTagColor: "violet",
    storyStatusColor: "rose",
    // The 3 track names on the back of every Theme card (and the Company Theme) — GM-defined,
    // campaign-wide, same as themeCategories above. Position matters (index 0/1/2), not the id,
    // since every Theme's own `tracks` array is always exactly 3 long in the same fixed order.
    trackLabels: [t("trackLabelAbandon"), t("trackLabelImprove"), t("trackLabelAdvance")],
  };
}

function normalizeCampaign(raw) {
  const cats = raw && Array.isArray(raw.themeCategories) ? raw.themeCategories : null;
  const defaults = defaultCampaign();
  const rawTrackLabels = raw && Array.isArray(raw.trackLabels) ? raw.trackLabels : null;
  return {
    themeCategories: cats
      ? cats.map((cat) => ({
          id: cat && cat.id ? cat.id : uid(),
          label: cat && typeof cat.label === "string" ? cat.label : "",
          color: cat && COLOR_KEYS.includes(cat.color) ? cat.color : "amber",
        }))
      : defaults.themeCategories,
    tagColor: raw && COLOR_KEYS.includes(raw.tagColor) ? raw.tagColor : "amber",
    statusColor: raw && COLOR_KEYS.includes(raw.statusColor) ? raw.statusColor : "sage",
    storyTagColor: raw && COLOR_KEYS.includes(raw.storyTagColor) ? raw.storyTagColor : "violet",
    storyStatusColor: raw && COLOR_KEYS.includes(raw.storyStatusColor) ? raw.storyStatusColor : "rose",
    trackLabels: [0, 1, 2].map((i) =>
      rawTrackLabels && typeof rawTrackLabels[i] === "string" ? rawTrackLabels[i] : defaults.trackLabels[i]
    ),
  };
}

function getCampaign() {
  // defaultCampaign() mints fresh random category ids every call — without this write-through,
  // a category picked before the GM ever opens Settings (which is the only place that used to
  // persist the campaign) would stop matching on the very next render, since a later getCampaign()
  // call would silently generate a different set of ids. Persist the very first default so ids
  // stay stable from the moment a room is created.
  if (!roomMeta[ROOM_KEYS.campaign]) {
    roomMeta[ROOM_KEYS.campaign] = defaultCampaign();
    scheduleRoomSave(ROOM_KEYS.campaign);
  }
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
    titleBurned: false,
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
    tags: [],
    statuses: [],
    notes: "",
    // Per-character override of a Story Tag/Status's polarity (storyTagOrStatusId -> "positive" |
    // "negative") — see storyItemPolarity() below. The GM authors one default polarity per Story
    // item, but the same scene condition can cut opposite ways for different characters (dim
    // light hurts most people, but not someone with darkvision), so each character keeps their
    // own override instead of sharing a single polarity across the whole table.
    storyPolarity: {},
  };
}

// A Status's 6 tiers can be crossed off out of order (per the rules, a Status doesn't always
// fill/empty its boxes strictly left-to-right), so each box is its own independent boolean
// rather than a single "filled up to N" counter like a Theme track.
function normalizeStatus(raw) {
  const id = raw && raw.id ? raw.id : uid();
  const name = raw && typeof raw.name === "string" ? raw.name : "";
  // Whether this Status helps (+level) or hurts (-level) the Potere tally when ticked active —
  // defaults to positive for both new Statuses and any saved before this field existed, since
  // there's no way to infer polarity from old data; correct via the status-polarity toggle.
  const polarity = raw && raw.polarity === "negative" ? "negative" : "positive";
  if (raw && Array.isArray(raw.boxes)) {
    const boxes = raw.boxes.slice(0, 6).map(Boolean);
    while (boxes.length < 6) boxes.push(false);
    return { id, name, boxes, polarity };
  }
  // Migrate the old {level: N} shape (a simple 1..N counter) into boxes 1..N filled.
  const legacyLevel = raw && typeof raw.level === "number" ? raw.level : 0;
  return { id, name, boxes: Array.from({ length: 6 }, (_, i) => i < legacyLevel), polarity };
}

function normalizeCharacter(raw, id) {
  const c = Object.assign(defaultCharacter(id), raw || {}, { id });
  c.background = typeof c.background === "string" ? c.background : "";
  c.themes = Array.isArray(c.themes) ? c.themes : [];
  // Backpack items can now be ticked (+1) and burned (+3 instead, mirroring a Power tag) toward
  // Total Power — burned defaults to false for both new items and any saved before this field
  // existed. The older separate "used" cross-off was dropped: a fully-consumed item is burned
  // (which already reads as spent) and then deleted, so a second "used" marker was redundant.
  // Any "used" flag left over in old saved data is simply ignored from here on.
  c.backpack = Array.isArray(c.backpack)
    ? c.backpack.map((it) => ({
        id: it && it.id ? it.id : uid(),
        text: it && typeof it.text === "string" ? it.text : "",
        burned: !!(it && it.burned),
      }))
    : [];
  // An Active Tag can now help (+1) or hurt (-1) the roll when ticked — polarity defaults to
  // positive for both new tags and any saved before this field existed, same reasoning as a
  // Status's polarity default.
  c.tags = Array.isArray(c.tags)
    ? c.tags.map((tg) => ({
        id: tg && tg.id ? tg.id : uid(),
        text: tg && typeof tg.text === "string" ? tg.text : "",
        polarity: tg && tg.polarity === "negative" ? "negative" : "positive",
      }))
    : [];
  c.statuses = Array.isArray(c.statuses) ? c.statuses.map(normalizeStatus) : [];
  c.storyPolarity = {};
  if (raw && raw.storyPolarity && typeof raw.storyPolarity === "object") {
    Object.entries(raw.storyPolarity).forEach(([id, polarity]) => {
      if (polarity === "positive" || polarity === "negative") c.storyPolarity[id] = polarity;
    });
  }
  c.themes.forEach((th) => {
    th.power = Array.isArray(th.power) ? th.power : [];
    th.weakness = Array.isArray(th.weakness) ? th.weakness : [];
    th.tracks = ensureThreeTracks(th.tracks);
    th.categoryId = typeof th.categoryId === "string" ? th.categoryId : null;
    th.titleBurned = typeof th.titleBurned === "boolean" ? th.titleBurned : false;
  });
  return c;
}

function getCharacter(id) {
  return normalizeCharacter(roomMeta[characterKey(id)], id);
}

// Loads the character, makes it the live object stored in roomMeta (so in-place mutation +
// scheduleRoomSave works exactly like the rest of the app), and returns {character, save}.
//
// Reuses the SAME object identity across re-renders whenever roomMeta already holds a live,
// normalized character for this id, instead of building a fresh one every call. Without this,
// any re-render that happens while e.g. a delete-confirm dialog is open (an OBR room-metadata
// echo, a player.onChange, a font/lang toggle) replaces roomMeta[key] with a brand-new object —
// the dialog's onConfirm still mutates the OLD (now orphaned) object, save() persists the
// unmutated new one, and the delete silently does nothing until tried a second time.
function bindCharacter(id) {
  const key = characterKey(id);
  const existing = roomMeta[key];
  const character = existing && existing.id === id ? existing : getCharacter(id);
  roomMeta[key] = character;
  return { character, save: () => scheduleRoomSave(key) };
}

// ---------- Total Power tally ----------
// Straight from Legend in the Mist Vol. I, p.151 "Calcola il Potere dell'Azione": +1 per
// activated Power tag, -1 per activated Weakness tag, +3 (instead of the tag's own +1) for
// burning one Power tag, and +/- the LEVEL of only the single best positive and single worst
// negative active Status (never a flat +1, never summed across every active Status). The
// Favored/Disfavored +/-3 or +/-6 from Valore isn't something the sheet can know on its own, so
// that (and any GM-granted extras) goes through the manual modifier instead.
function computeTotalPower(character) {
  let total = 0;

  character.themes.forEach((theme) => {
    // The Theme's title is itself a Power tag (see renderThemeTitlePill).
    if (rollSelection.has(theme.id)) total += theme.titleBurned ? 3 : 1;
    theme.power.forEach((tag) => {
      if (rollSelection.has(tag.id)) total += tag.burned ? 3 : 1;
    });
    theme.weakness.forEach((tag) => {
      if (rollSelection.has(tag.id)) total -= 1;
    });
  });

  // Active Tags are this app's own generic marker, not a specific rulebook Attributo type, so
  // every ticked one just adds its own +1/-1 (per its polarity) — unlike Statuses, there's no
  // "only the single best counts" restriction here.
  character.tags.forEach((tag) => {
    if (rollSelection.has(tag.id)) total += tag.polarity === "negative" ? -1 : 1;
  });

  // Story Tags (GM-authored, scene-wide — see the Scene tab) count exactly like a personal Active
  // Tag: every ticked one adds its own +1/-1, uncapped, stacking with everything else here. Uses
  // THIS character's own polarity override where set (see storyItemPolarity) since the same scene
  // condition can cut opposite ways for different characters.
  getStoryTags().tags.forEach((tag) => {
    if (rollSelection.has(tag.id)) total += storyItemPolarity(character, tag) === "negative" ? -1 : 1;
  });

  // Backpack items tick/burn exactly like a Power tag (+1 ticked, +3 instead if burned).
  character.backpack.forEach((item) => {
    if (rollSelection.has(item.id)) total += item.burned ? 3 : 1;
  });

  // Story Statuses feed into the SAME best-positive/worst-negative pool as personal Statuses
  // below (not a separate cap) — per the rulebook, only one positive and one negative Status
  // count total toward a roll, regardless of whether it belongs to the character or the scene.
  let bestPositive = 0;
  let worstNegative = 0;
  const tallyStatus = (s, polarity) => {
    if (!rollSelection.has(s.id)) return;
    const level = s.boxes.lastIndexOf(true) + 1; // highest ticked box = current level; 0 if none
    if (level <= 0) return;
    if (polarity === "negative") worstNegative = Math.max(worstNegative, level);
    else bestPositive = Math.max(bestPositive, level);
  };
  character.statuses.forEach((s) => tallyStatus(s, s.polarity));
  // Story Statuses use THIS character's own polarity override where set (see storyItemPolarity),
  // same reasoning as Story Tags above.
  getStoryTags().statuses.forEach((s) => tallyStatus(s, storyItemPolarity(character, s)));
  total += bestPositive - worstNegative;

  total += rollModifiers.get(character.id) || 0;
  return total;
}

// Un-ticks every id belonging to this specific character (not the whole rollSelection Set, so a
// GM mid-tally on a different Roster character isn't affected) and clears its modifier. Also
// un-ticks any currently-ticked Story Tags/Statuses (see renderActiveTagsSection's Scene Tags
// block) — they don't "belong" to any one character the way personal tags do, but a player
// pressing Reset expects it to clear everything selected for their upcoming roll, story items
// included, not just their own sheet's tags.
function resetTotalPower(character) {
  character.themes.forEach((theme) => {
    rollSelection.delete(theme.id);
    theme.power.forEach((tag) => rollSelection.delete(tag.id));
    theme.weakness.forEach((tag) => rollSelection.delete(tag.id));
  });
  character.tags.forEach((tag) => rollSelection.delete(tag.id));
  character.backpack.forEach((item) => rollSelection.delete(item.id));
  character.statuses.forEach((s) => rollSelection.delete(s.id));
  const storyTags = getStoryTags();
  storyTags.tags.forEach((tag) => rollSelection.delete(tag.id));
  storyTags.statuses.forEach((s) => rollSelection.delete(s.id));
  rollModifiers.delete(character.id);
}

// ---------- roll log (2d6 + Total Power, shared + persisted room-wide) ----------
// A roll is just one more capped array under its own room-metadata key, following the exact same
// ROOM_KEYS/scheduleRoomSave/OBR.room.onMetadataChange pattern as everything else in this file —
// every connected client (including the background-popover corner panel, which is this same app
// loaded with ?view=rolllog) already gets pushed a live update through that listener, so rolling
// needs no separate broadcast mechanism.

function getRollLog() {
  const raw = roomMeta[ROOM_KEYS.rollLog];
  return Array.isArray(raw) ? raw : [];
}

// Tracks the last roll-log entry this client has already played a sound for, so the
// OBR.room.onMetadataChange listener (boot(), below) can tell "a genuinely new roll just landed"
// apart from "this is just the echo of my own save" or "this is the very first sync on page
// load" — see rollDice() and boot() for where these get set.
let lastAnnouncedRollId = null;
let rollLogSoundReady = false;

// Straight from the same 2d6+Potere resolution this whole tally exists to feed: 10+ full success,
// 7-9 mixed success, 6- failure. Recomputed from the stored total at render time rather than
// stored on the entry itself — it's a pure function of one number, no need to persist it twice.
function rollOutcome(total) {
  if (total >= 10) return "success";
  if (total >= 7) return "mixed";
  return "failure";
}

// Assigns each character a stable color for their name in the roll log, hashed from the
// character's id (not its current name) so renaming a character doesn't shuffle its color, and
// reloading the page reproduces the same color instead of re-randomizing on every render.
// 8 hues spaced 45° apart around the wheel — the maximum equal spacing for 8 colors — so any
// table of up to 8 characters gets colors that are actually easy to tell apart at a glance, not
// just "different" in the technical sense a plain hash could land you (two arbitrary hashed hues
// can easily fall 10-15° apart and read as near-identical browns). Offset from 0/90/180/270 so
// none of them sit on top of the roll-total outcome colors (sage ~100°, amber ~36°, danger ~4°).
const ROLL_LOG_NAME_HUES = [20, 65, 110, 155, 200, 245, 290, 335];

function colorForCharacterId(id) {
  // Index by the character's position in the roster (stable insertion order, already persisted)
  // rather than hashing — this is what actually guarantees zero collisions for any table with up
  // to 8 characters, since distinct roster positions mod 8 stay distinct up to that count. A
  // character no longer in the roster (removed after it had already rolled) falls back to a hash
  // instead, so its old log entries still get a stable color, just without the collision guarantee.
  const roster = getRoster();
  let idx = roster.findIndex((r) => r.id === id);
  if (idx < 0) {
    const str = String(id || "");
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    idx = Math.abs(hash);
  }
  const hue = ROLL_LOG_NAME_HUES[idx % ROLL_LOG_NAME_HUES.length];
  return `hsl(${hue}, 60%, 32%)`; // dark/saturated enough to stay readable on the parchment list
}

function rollDice(character) {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const power = computeTotalPower(character);
  const entry = {
    id: uid(),
    characterId: character.id,
    characterName: character.name || t("characterNamePlaceholder"),
    dice: [d1, d2],
    power,
    total: d1 + d2 + power,
    timestamp: Date.now(),
  };
  const log = getRollLog().concat(entry);
  while (log.length > ROLL_LOG_MAX_ENTRIES) log.shift();
  roomMeta[ROOM_KEYS.rollLog] = log;
  scheduleRoomSave(ROOM_KEYS.rollLog);
  // Deliberately does NOT touch rollSelection/rollModifiers — rolling and the manual Reset button
  // stay independent actions (see resetTotalPower's own comment on why Reset is manual).

  // Play immediately for the roller (this click is a real user gesture, so autoplay is never
  // blocked here) rather than waiting on the room-metadata round trip. Mark this id as already
  // announced first, so when that round trip's onMetadataChange echo does arrive (see boot()),
  // this same client doesn't play the sound a second time for its own roll.
  lastAnnouncedRollId = entry.id;
  playDiceRollSound();

  // In standalone/local-preview mode there's no background popover — the corner widget is instead
  // embedded directly in this same page (see renderApp()) — so refresh it immediately rather than
  // waiting on the localStorage round-trip that real OBR clients rely on for their own copy.
  if (backend === "standalone") refreshRollLogWidget();
}

function clearRollLog() {
  roomMeta[ROOM_KEYS.rollLog] = [];
  scheduleRoomSave(ROOM_KEYS.rollLog);
  // Every other destructive action in this app (deleting a Theme/tag/Backpack item/Roster
  // character) refreshes its own view immediately after mutating + scheduling the save, instead
  // of waiting on the round trip through OBR.room.onMetadataChange to do it — and for good reason:
  // once that echo lands it describes a value that already matches what this page applied
  // locally, so the "skip no-op echoes" guard in boot() (see the comment there, deepEqual(meta,
  // roomMeta)) correctly treats it as nothing new and never re-renders. Only refreshing here for
  // the standalone backend left a real player's own view of the roll log frozen on the old
  // entries after clicking Clear on the real obr backend — the data was actually cleared, it just
  // never visibly updated for the person who cleared it. Refresh unconditionally, matching every
  // other delete in the app.
  refreshRollLogWidget();
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

// Same object-identity-reuse reasoning as bindCharacter() above — otherwise an open confirm
// dialog on a Company tag can be silently orphaned by an intervening re-render.
function bindCompany() {
  const existing = roomMeta[ROOM_KEYS.company];
  const company = existing || getCompany();
  roomMeta[ROOM_KEYS.company] = company;
  return { company, save: () => scheduleRoomSave(ROOM_KEYS.company) };
}

// ---------- Story Tags & Statuses (GM-authored, shared room-wide — see the Scene tab) ----------
// Same shape as a character's own tags/statuses (defaultCharacter/normalizeStatus above), but
// scene-wide instead of personal: the GM adds/edits them on the Scene tab, everyone else can only
// tick them (same tickToggle/rollSelection mechanism personal Active Tags already use) so they
// count toward whichever character's Total Power is currently showing. See computeTotalPower().

function defaultStoryTags() {
  return { tags: [], statuses: [] };
}

function normalizeStoryTags(raw) {
  const tags = raw && Array.isArray(raw.tags) ? raw.tags : [];
  const statuses = raw && Array.isArray(raw.statuses) ? raw.statuses : [];
  return {
    tags: tags.map((tg) => ({
      id: tg && tg.id ? tg.id : uid(),
      text: tg && typeof tg.text === "string" ? tg.text : "",
      polarity: tg && tg.polarity === "negative" ? "negative" : "positive",
    })),
    statuses: statuses.map(normalizeStatus),
  };
}

function getStoryTags() {
  return normalizeStoryTags(roomMeta[ROOM_KEYS.storyTags]);
}

// Same object-identity-reuse reasoning as bindCompany() above — otherwise an open delete-confirm
// dialog on a story tag/status can be silently orphaned by an intervening re-render.
function bindStoryTags() {
  const existing = roomMeta[ROOM_KEYS.storyTags];
  const storyTags = existing || getStoryTags();
  roomMeta[ROOM_KEYS.storyTags] = storyTags;
  return { storyTags, save: () => scheduleRoomSave(ROOM_KEYS.storyTags) };
}

// The GM authors one default polarity per Story Tag/Status, but each character can flip it for
// themselves (see character.storyPolarity above) since the same scene condition can help one
// character and hurt another. Falls back to the GM's authored default when this character hasn't
// overridden it.
function storyItemPolarity(character, item) {
  // Defensive fallback, not just belt-and-suspenders: bindCharacter() (see its own comment) reuses
  // whatever object is already sitting in roomMeta for this id as-is, WITHOUT re-running it through
  // normalizeCharacter — so a character saved before storyPolarity existed (any real character in
  // an already-live room, the moment this feature ships) legitimately has no storyPolarity field
  // yet the first time it's touched this session.
  const override = character.storyPolarity && character.storyPolarity[item.id];
  return override === "positive" || override === "negative" ? override : item.polarity;
}

function setStoryItemPolarity(character, save, item, polarity) {
  if (!character.storyPolarity) character.storyPolarity = {};
  character.storyPolarity[item.id] = polarity;
  save();
  refreshTabContent();
}

// ---------- top-level render ----------

function renderApp() {
  closeConfirmDialog();
  app.innerHTML = "";

  // The roll-log corner panel's own dedicated page (?view=rolllog, see background.html) shows
  // nothing but the dice pill/panel — none of the character-sheet chrome below.
  if (isRollLogView) {
    app.appendChild(renderRollLogPanel());
    return;
  }

  if (backend === "standalone") {
    app.appendChild(el("div", { class: "standalone-banner" }, t("standaloneBanner")));
  }

  if (activeTab === "scene" && !isGM()) activeTab = "sheet";
  if (activeTab === "roster" && !isGM()) activeTab = "sheet";
  if (activeTab === "settings" && !isGM()) activeTab = "sheet";

  app.appendChild(renderTopbar());

  const content = el("div", { id: "tab-content" });
  content.appendChild(renderActiveTab());
  app.appendChild(content);

  app.appendChild(el("footer", { class: "credits" }, t("footer")));

  // Real Owlbear gets the shared roll log via its own always-on background-popover page instead
  // (see background.html) — but that mechanism doesn't exist outside a real room, so standalone/
  // local-preview mode embeds the identical panel here as a fixed corner overlay so the feature
  // stays testable without Owlbear. Respects the same personal hide toggle as the real popover.
  if (backend === "standalone" && !rollLogPanelHidden) {
    app.appendChild(renderRollLogPanel());
  }
}

function renderActiveTab() {
  if (activeTab === "company") return renderCompanyTab();
  if (activeTab === "scene" && isGM()) return renderSceneTab();
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
  // Order left-to-right, per explicit request: font size down/up, roll-log viewer toggle,
  // language, fullscreen/expand last (rightmost) — all rendered as identically-sized boxes via
  // the shared .icon-btn sizing rule, .lang-toggle included, so the row reads as one consistent
  // button group instead of a mix of pill and icon shapes.
  const rollLogToggleBtn = el("button", {
    class: "icon-btn",
    title: rollLogPanelHidden ? t("showRollLogPanelTitle") : t("hideRollLogPanelTitle"),
    "aria-label": rollLogPanelHidden ? t("showRollLogPanelTitle") : t("hideRollLogPanelTitle"),
    onclick: () => setRollLogPanelHidden(!rollLogPanelHidden),
  });
  rollLogToggleBtn.appendChild(rollLogPanelHidden ? diceOffIcon(14) : diceIcon(14));
  controls.appendChild(rollLogToggleBtn);
  controls.appendChild(
    el("button", {
      class: "icon-btn",
      title: t("langToggleTitle"),
      text: lang === "en" ? "IT" : "EN",
      onclick: () => setLang(lang === "en" ? "it" : "en"),
    })
  );
  const expandBtn = el("button", {
    class: "icon-btn",
    title: isModalView ? t("collapseViewTitle") : t("expandViewTitle"),
    onclick: () => (isModalView ? closeExpandedView() : openExpandedView()),
  });
  expandBtn.appendChild(isModalView ? collapseIcon() : expandIcon());
  controls.appendChild(expandBtn);
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
      // GM-only: the GM authors Story Tags/Statuses here, but every player ticks them straight
      // from their own Active Tags section (see renderActiveTagsSection) instead of needing to
      // switch to this tab — so unlike the old design, players never need to open it at all.
      el("button", {
        class: "tab-btn" + (activeTab === "scene" ? " active" : ""),
        text: t("tabScene"),
        onclick: () => { activeTab = "scene"; renderApp(); },
      }),
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

  wrap.appendChild(renderNameAndBackgroundSection(character, save));

  wrap.appendChild(renderActiveTagsSection(character, save));

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
  wrap.appendChild(renderNotesSection(character, save));

  return wrap;
}

// ---------- Name + Background (collapsible free-form character story) ----------
// The Background toggle sits on the right of the name, as a small book-icon button rather than
// a spelled-out label — and the dashed divider that used to sit directly under the name input
// now sits at the bottom of this whole block, so an opened Background text box appears above the
// divider (inside the header), not as its own separate section below it. Also holds the Total
// Power chip + manual modifier + reset, between the name and the Background toggle.

function renderNameAndBackgroundSection(character, save) {
  const isOpen = expandedBackgroundIds.has(character.id);
  const section = el("div", { class: "section sheet-header" });

  const row = el("div", { class: "sheet-header-row" });
  row.appendChild(
    el("input", {
      class: "character-name-input",
      type: "text",
      placeholder: t("characterNamePlaceholder"),
      value: character.name,
      oninput: (e) => { character.name = e.target.value; save(); },
    })
  );

  // Total Power + modifier + reset + Background all live in one cluster, pushed to the far
  // right of the row (see .header-power-cluster's margin-left:auto) so the name stays left-
  // anchored instead of the controls just trailing immediately after it with dead space beyond.
  const cluster = el("div", { class: "header-power-cluster" });

  // Total Power: a live tally of everything ticked (Power/Weakness tags, the Theme title,
  // Active Tags, Backpack items, best/worst Status) plus a manual +/- modifier for
  // Favored/Disfavored and other GM-granted extras the sheet can't infer on its own. All scratch
  // state for "the roll about to happen" (see the rollSelection/rollModifiers comment) — Reset
  // clears it without touching any permanent data (tag.burned, Status polarity/levels stay
  // exactly as they are).
  const powerChip = el("div", { class: "total-power-chip", title: t("totalPowerTitle") });
  powerChip.appendChild(el("span", { class: "total-power-label", text: t("totalPowerLabel") }));
  const powerValueEl = el("span", { class: "total-power-value", text: String(computeTotalPower(character)) });
  powerChip.appendChild(powerValueEl);
  cluster.appendChild(powerChip);

  // Updates just the number in place instead of a full refreshTabContent() re-render, which
  // would tear down and rebuild this very input on every keystroke and throw away focus/cursor
  // position after each digit typed.
  cluster.appendChild(
    el("input", {
      class: "power-modifier-input",
      type: "number",
      title: t("powerModifierTitle"),
      "aria-label": t("powerModifierTitle"),
      value: String(rollModifiers.get(character.id) || 0),
      oninput: (e) => {
        const n = parseInt(e.target.value, 10);
        if (Number.isNaN(n)) rollModifiers.delete(character.id);
        else rollModifiers.set(character.id, n);
        powerValueEl.textContent = String(computeTotalPower(character));
      },
    })
  );

  const resetBtn = el("button", {
    class: "icon-btn-round power-reset-btn",
    title: t("resetPowerTitle"),
    "aria-label": t("resetPowerTitle"),
    onclick: () => {
      resetTotalPower(character);
      refreshTabContent();
    },
  });
  resetBtn.appendChild(resetIcon());
  cluster.appendChild(resetBtn);

  // Rolls 2d6, adds the Total Power shown in powerValueEl above, and logs the result to the
  // shared, persistent corner panel every connected player sees (see rollDice()/background.html).
  const rollBtn = el("button", {
    class: "icon-btn-round dice-roll-btn",
    title: t("rollButtonTitle"),
    "aria-label": t("rollButtonTitle"),
    onclick: () => rollDice(character),
  });
  rollBtn.appendChild(diceIcon());
  cluster.appendChild(rollBtn);

  const bgToggle = el("button", {
    class: "icon-btn-round background-toggle",
    title: t("backgroundTitle"),
    "aria-label": t("backgroundTitle"),
    onclick: () => {
      if (isOpen) expandedBackgroundIds.delete(character.id);
      else expandedBackgroundIds.add(character.id);
      refreshTabContent();
    },
  });
  bgToggle.appendChild(bookIcon());
  cluster.appendChild(bgToggle);

  row.appendChild(cluster);
  section.appendChild(row);

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

// A Theme's title/name is itself a Power tag in the rules (it can be invoked and burned just
// like any other Power tag), so it's rendered as one: same pill shape, same claw icon, a
// burn/restore toggle. It still needs to wrap onto a second line instead of clipping when it's
// longer than the card width — a plain <input> can't wrap, so the text field inside the pill
// uses the standard CSS-grid "replicated value" auto-grow trick: a hidden ::after with the same
// text drives the grid row's height, and the real <textarea> (which does wrap) sits on top of
// it, no JS height-measuring needed.
function renderThemeTitlePill(theme, save, rerender) {
  const pill = el("div", { class: "theme-title-pill" + (theme.titleBurned ? " burned" : "") });

  const flameBtn = el("button", {
    class: "flame",
    title: theme.titleBurned ? t("restoreTitle") : t("burnTitle"),
    onclick: () => {
      theme.titleBurned = !theme.titleBurned;
      // Burning ticks it (so it immediately reads as the +3 it now is); recovering un-ticks it
      // so it doesn't linger miscounted as a stray +1 after the burn is undone.
      if (theme.titleBurned) rollSelection.add(theme.id);
      else rollSelection.delete(theme.id);
      save();
      // Same reasoning as the tick handler above: this also changes Total Power, which lives in
      // the header outside this card.
      refreshTabContent();
    },
  });
  if (theme.titleBurned) {
    flameBtn.textContent = "🔥";
  } else {
    flameBtn.appendChild(clawIcon());
  }
  pill.appendChild(flameBtn);

  const wrap = el("div", { class: "theme-title-wrap", "data-replicated-value": theme.title || "" });
  wrap.appendChild(
    el(
      "textarea",
      {
        class: "theme-title-input",
        rows: "1",
        placeholder: t("themeTitlePlaceholder"),
        oninput: (e) => {
          theme.title = e.target.value;
          wrap.setAttribute("data-replicated-value", e.target.value);
          save();
        },
      },
      theme.title
    )
  );
  pill.appendChild(wrap);

  // The title is itself a Power tag, so it ticks toward Total Power (+1) exactly like one — see
  // computeTotalPower(). Burning it (above) counts +3 instead and ticks it automatically. Sits
  // right-aligned at the end of the pill — the title pill has no delete button to sit next to,
  // but every other tick in this app sits at the right edge of its row, so this matches that.
  pill.appendChild(
    tickToggle(rollSelection.has(theme.id), t("tickPowerTitle"), () => {
      if (rollSelection.has(theme.id)) rollSelection.delete(theme.id);
      else rollSelection.add(theme.id);
      // A tick changes the Total Power number shown in the header, which lives outside this
      // card — replaceThemeCard() only swaps this one card's DOM, so it would never pick up the
      // new tally. refreshTabContent() rebuilds the whole tab (header included) instead.
      refreshTabContent();
    })
  );

  return pill;
}

function renderThemeFront(character, save, theme, cardNode) {
  const face = el("div", { class: "theme-face front " + categoryColorClass(theme.categoryId) });

  // Full-width banner: category color says which category this is (the picker itself now lives
  // on the back, out of the way), and the left side is a free-text field for the Theme's Type —
  // the thematic-kit descriptor (e.g. "Identity", "Community") — always visible here instead of
  // hidden behind "Show more" like before.
  const banner = el("div", { class: "theme-banner " + categoryColorClass(theme.categoryId) });
  banner.appendChild(
    el("input", {
      class: "banner-type-input",
      type: "text",
      placeholder: t("themeTypePlaceholder"),
      value: theme.type,
      oninput: (e) => { theme.type = e.target.value; save(); },
    })
  );
  const actions = el("div", { class: "banner-actions" });

  const addPowerBtn = el("button", {
    class: "icon-btn-round",
    title: t("addPower"),
    "aria-label": t("addPower"),
    onclick: () => {
      theme.power.push({ id: uid(), text: "", burned: false });
      save();
      replaceThemeCard(character, save, theme);
    },
  });
  addPowerBtn.appendChild(clawIcon());
  actions.appendChild(addPowerBtn);

  const weaknessAtCap = theme.weakness.length >= 3;
  const addWeaknessBtn = el("button", {
    class: "icon-btn-round",
    title: t("addWeakness"),
    "aria-label": t("addWeakness"),
    disabled: weaknessAtCap ? "disabled" : undefined,
    onclick: () => {
      if (theme.weakness.length >= 3) return;
      theme.weakness.push({ id: uid(), text: "", burned: false });
      save();
      replaceThemeCard(character, save, theme);
    },
  });
  addWeaknessBtn.appendChild(chevronsDownIcon());
  actions.appendChild(addWeaknessBtn);

  const flipBtn = el("button", { class: "flip-btn", title: t("flipTitle"), onclick: () => flipCard(theme.id, cardNode) });
  flipBtn.appendChild(flipIcon());
  actions.appendChild(flipBtn);
  banner.appendChild(actions);
  face.appendChild(banner);

  const body = el("div", { class: "theme-face-body" });

  body.appendChild(renderThemeTitlePill(theme, save, () => replaceThemeCard(character, save, theme)));

  body.appendChild(
    renderTagList(theme, "power", false, save, () => replaceThemeCard(character, save, theme), { hideHeader: true, tickPower: true })
  );
  body.appendChild(
    renderTagList(theme, "weakness", true, save, () => replaceThemeCard(character, save, theme), { hideHeader: true, tickPower: true })
  );

  // Quest is secondary info (checked occasionally, not every beat of play), so in the compact
  // popover it sits behind a "Show more" toggle — Title (as a Power tag), the Power/Weakness
  // tags, and Type (now on the banner) stay visible with zero clicks, which is what's actually
  // referenced constantly during a scene. The expanded/full-screen view has room to spare and is
  // opened specifically to see everything at once, so there the toggle is skipped and Quest is
  // always shown.
  const moreOpen = isModalView || expandedThemeExtraIds.has(theme.id);
  if (!isModalView) {
    body.appendChild(
      el("button", {
        class: "theme-more-toggle",
        text: (moreOpen ? "▴ " : "▾ ") + (moreOpen ? t("showLess") : t("showMore")),
        onclick: () => {
          if (moreOpen) expandedThemeExtraIds.delete(theme.id);
          else expandedThemeExtraIds.add(theme.id);
          replaceThemeCard(character, save, theme);
        },
      })
    );
  }

  if (moreOpen) {
    const moreBody = el("div", { class: "theme-more-body" });
    moreBody.appendChild(el("label", { class: "field-label", text: t("questionLabel") }));
    moreBody.appendChild(
      el("textarea", {
        class: "mission-text",
        placeholder: t("questionPlaceholder"),
        oninput: (e) => { theme.question = e.target.value; save(); },
      }, theme.question)
    );
    body.appendChild(moreBody);
  }

  face.appendChild(body);
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

  if (!opts.hideHeader) {
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
  }

  const list = el("div", { class: "tag-list" });
  owner[kind].forEach((tag) => {
    const pill = el("div", { class: "tag-pill" + (kind === "weakness" ? " weakness" : "") + (tag.burned ? " burned" : "") });

    const flameBtn = el("button", {
      class: "flame",
      title: tag.burned ? crossTitleOff : crossTitleOn,
      onclick: () => {
        tag.burned = !tag.burned;
        if (opts.tickPower) {
          // Burning ticks it (reads as the +3 it now is); recovering un-ticks it so it doesn't
          // linger miscounted as a stray +1 once the burn is undone.
          if (tag.burned) rollSelection.add(tag.id);
          else rollSelection.delete(tag.id);
        }
        save();
        // tickPower tags affect the header's Total Power display; the Company Theme's tags
        // (opts.tickPower unset) don't, but a full refresh is harmless for them either way.
        opts.tickPower ? refreshTabContent() : rerender();
      },
    });
    if (tag.burned) {
      flameBtn.textContent = "🔥";
    } else if (kind === "weakness") {
      flameBtn.appendChild(chevronsDownIcon());
    } else {
      flameBtn.appendChild(clawIcon());
    }
    pill.appendChild(flameBtn);

    if (readOnly) {
      pill.appendChild(el("span", { class: "tag-text-readonly", text: tag.text || "…" }));
    } else {
      // Same CSS-grid "replicated value" auto-grow-and-wrap trick as the Theme title (see
      // renderThemeTitlePill): a plain <input> with a growing "size" attribute just kept
      // stretching the pill wider and wider off the edge of the card for a long tag name,
      // clipped by the card's overflow instead of wrapping. A <textarea> wraps; the hidden
      // ::after sized off the same text drives the grid row's height to match.
      const textWrap = el("div", { class: "tag-text-wrap", "data-replicated-value": tag.text });
      textWrap.appendChild(
        el(
          "textarea",
          {
            class: "tag-text-input",
            rows: "1",
            placeholder: kind === "weakness" ? t("weaknessPlaceholder") : t("powerPlaceholder"),
            oninput: (e) => {
              tag.text = e.target.value;
              textWrap.setAttribute("data-replicated-value", e.target.value);
              save();
            },
          },
          tag.text
        )
      );
      pill.appendChild(textWrap);

      // Personal Theme tags tick toward Total Power (+1 Power / -1 Weakness, +3 to burn a Power
      // tag); the shared Company Theme's tags don't — different fiction (crossed on use, never
      // burned for Potere) and no per-character Potere tally to feed there. See
      // computeTotalPower(). Right-aligned: sits at the end of the pill, right before delete —
      // matching every other tick box in this app (and now the Theme title's too).
      if (opts.tickPower) {
        pill.appendChild(
          tickToggle(
            rollSelection.has(tag.id),
            kind === "weakness" ? t("tickWeaknessTitle") : t("tickPowerTitle"),
            () => {
              if (rollSelection.has(tag.id)) rollSelection.delete(tag.id);
              else rollSelection.add(tag.id);
              // Same reasoning as the Theme-title tick: this changes the Total Power number in
              // the header, which the narrower replaceThemeCard() rerender() never touches.
              refreshTabContent();
            }
          )
        );
      }

      const tagTrash = el("button", {
        class: "chip-trash",
        title: t("removeTagTitle"),
        "aria-label": t("removeTagTitle"),
        onclick: () => {
          showConfirmDialog(t("removeTagConfirm"), () => {
            owner[kind] = owner[kind].filter((tg) => tg.id !== tag.id);
            save();
            rerender();
          });
        },
      });
      tagTrash.appendChild(trashIcon());
      pill.appendChild(tagTrash);
    }
    list.appendChild(pill);
  });
  wrap.appendChild(list);

  return wrap;
}

function renderThemeBack(character, save, theme, cardNode) {
  const face = el("div", { class: "theme-face back " + categoryColorClass(theme.categoryId) });

  // Same banner as the front, for visual continuity — just the flip button on it (add-Power/
  // add-Weakness don't apply on the back). Type is read-only here; it's edited on the front.
  const banner = el("div", { class: "theme-banner " + categoryColorClass(theme.categoryId) });
  banner.appendChild(el("span", { class: "banner-type-text", text: theme.type || t("themeTypePlaceholder") }));
  const bannerActions = el("div", { class: "banner-actions" });
  const flipBtn = el("button", { class: "flip-btn", title: t("flipTitle"), onclick: () => flipCard(theme.id, cardNode) });
  flipBtn.appendChild(flipIcon());
  bannerActions.appendChild(flipBtn);
  banner.appendChild(bannerActions);
  face.appendChild(banner);

  const body = el("div", { class: "theme-face-body" });

  body.appendChild(
    renderTracksBlock(theme, save, () => replaceThemeCard(character, save, theme), {
      colorClass: categoryColorClass(theme.categoryId),
    })
  );

  body.appendChild(el("label", { class: "field-label", text: t("specialLabel") }));
  body.appendChild(
    el("textarea", {
      class: "special-text",
      placeholder: t("specialPlaceholder"),
      oninput: (e) => { theme.special = e.target.value; save(); },
    }, theme.special)
  );

  // Category picker moved here (off the front, out of the way) and the delete button, sharing
  // the bottom row.
  const footer = el("div", { class: "theme-back-footer" });
  footer.appendChild(renderCategoryPicker(theme, save, () => replaceThemeCard(character, save, theme)));
  const deleteBtn = el("button", {
    class: "btn danger small icon-only",
    title: t("removeTheme"),
    "aria-label": t("removeTheme"),
    onclick: () => {
      showConfirmDialog(t("removeThemeConfirm"), () => {
        character.themes = character.themes.filter((th) => th.id !== theme.id);
        save();
        refreshTabContent();
      });
    },
  });
  deleteBtn.appendChild(trashIcon());
  footer.appendChild(deleteBtn);
  body.appendChild(footer);

  face.appendChild(body);
  return face;
}

// Generic track-list renderer, used for personal Themes and the Company Theme. `owner`
// needs an array at owner.tracks, always exactly 3 (like the core book) — there's no add or
// remove UI. `readOnly` locks dot-clicks (used for the Company Theme when viewed by a non-GM
// player). Track names are no longer per-instance data: they're the GM's campaign-wide
// trackLabels (Settings tab), matched by position (index 0/1/2) since every Theme's `tracks`
// array is always in the same fixed order — so nobody editing a sheet can rename them here.
function renderTracksBlock(owner, save, rerender, opts = {}) {
  const readOnly = !!opts.readOnly;
  const colorClass = opts.colorClass || "no-category";
  const trackLabels = getCampaign().trackLabels;
  const wrap = el("div");

  owner.tracks.forEach((track, idx) => {
    const block = el("div", { class: "track-block" });
    const titleRow = el("div", { class: "track-title-row" });
    titleRow.appendChild(el("span", { class: "track-name", text: trackLabels[idx] || track.label }));

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
    titleRow.appendChild(dots);
    block.appendChild(titleRow);
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
          character.backpack.push({ id: uid(), text: "", burned: false });
          save();
          refreshTabContent();
        },
      }),
    ])
  );
  const rows = el("div", { class: "list-rows" });
  character.backpack.forEach((item) => {
    // No separate "used" checkbox any more — a fully-consumed item (a drunk potion, say) is
    // burned (which already reads as spent for Potere) and then deleted, so a second "used"
    // marker on top of that was redundant dead weight in the row.
    const row = el("div", { class: "list-row" + (item.burned ? " burned" : "") });
    // An item can be burned for Potere exactly like a Power tag (+3 instead of the +1 it gives
    // when just ticked) — same flame button, same claw/flame icon swap. See computeTotalPower().
    const flameBtn = el("button", {
      class: "flame",
      title: item.burned ? t("restoreItemTitle") : t("burnItemTitle"),
      onclick: () => {
        item.burned = !item.burned;
        // Burning ticks it (reads as the +3 it now is); recovering un-ticks it so it doesn't
        // linger miscounted as a stray +1 once the burn is undone.
        if (item.burned) rollSelection.add(item.id);
        else rollSelection.delete(item.id);
        save();
        refreshTabContent();
      },
    });
    if (item.burned) {
      flameBtn.textContent = "🔥";
    } else {
      flameBtn.appendChild(clawIcon());
    }
    row.appendChild(flameBtn);
    // A plain <input>'s text-decoration doesn't reliably render in every browser (it silently
    // does nothing in some), so a burned item's strikethrough was invisible there even though a
    // burned Power tag's was fine — tags use a <textarea>, not an <input>. Reusing that same
    // .tag-text-wrap/.tag-text-input trick here (rather than inventing a separate technique)
    // makes the burned look actually render, and picks up long-name wrapping as a side benefit.
    const itemTextWrap = el("div", { class: "tag-text-wrap", "data-replicated-value": item.text });
    itemTextWrap.appendChild(
      el(
        "textarea",
        {
          class: "tag-text-input",
          rows: "1",
          placeholder: t("itemPlaceholder"),
          oninput: (e) => {
            item.text = e.target.value;
            itemTextWrap.setAttribute("data-replicated-value", e.target.value);
            save();
          },
        },
        item.text
      )
    );
    row.appendChild(itemTextWrap);
    // Tick sits right before the delete button, at the end of the row.
    row.appendChild(
      tickToggle(rollSelection.has(item.id), t("tickItemTitle"), () => {
        if (rollSelection.has(item.id)) rollSelection.delete(item.id);
        else rollSelection.add(item.id);
        refreshTabContent();
      })
    );
    const itemTrash = el("button", {
      class: "chip-trash",
      title: t("removeItem"),
      "aria-label": t("removeItem"),
      onclick: () => {
        showConfirmDialog(t("removeItemConfirm"), () => {
          character.backpack = character.backpack.filter((i) => i.id !== item.id);
          save();
          refreshTabContent();
        });
      },
    });
    itemTrash.appendChild(trashIcon());
    row.appendChild(itemTrash);
    rows.appendChild(row);
  });
  section.appendChild(rows);
  return section;
}

// ---------- Active Tags (Tags + Statuses) ----------
// Two different item kinds sharing one section: a Tag is just a name (no counter — a simple
// marker like "high ground"), a Status has 6 numbered boxes that toggle independently (tiers
// aren't always crossed off in order, per the rules). Each kind gets its own GM-configurable
// color (campaign.tagColor / campaign.statusColor), set on the Settings tab.

function renderActiveTagsSection(character, save) {
  const campaign = getCampaign();
  const tagColorClass = "color-" + campaign.tagColor;
  const statusColorClass = "color-" + campaign.statusColor;

  const section = el("div", { class: "section" });

  const addTagBtn = el("button", {
    class: "btn small add-btn",
    text: t("addActiveTag"),
    onclick: () => {
      character.tags.push({ id: uid(), text: "", polarity: "positive" });
      save();
      refreshTabContent();
    },
  });
  const addStatusBtn = el("button", {
    class: "btn small add-btn",
    text: t("addStatus"),
    onclick: () => {
      character.statuses.push({ id: uid(), name: "", boxes: [false, false, false, false, false, false] });
      save();
      refreshTabContent();
    },
  });
  section.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("activeTagsTitle") }),
      el("div", { class: "title-buttons" }, [addTagBtn, addStatusBtn]),
    ])
  );
  const list = el("div", { class: "active-tags-list" });

  character.tags.forEach((tag) => {
    const chip = el("div", { class: "active-tag-chip " + tagColorClass });

    chip.appendChild(
      el("input", {
        type: "text",
        value: tag.text,
        placeholder: t("activeTagPlaceholder"),
        oninput: (e) => { tag.text = e.target.value; save(); },
      })
    );
    // Active Tags are this app's own generic marker (not a specific rulebook Attributo type), so
    // — unlike Statuses — every ticked one just adds its own +1/-1 toward Total Power, with no
    // "only the single best counts" restriction. Same polarity toggle as a Status, since a tag
    // can represent something currently helping OR hurting the character. See computeTotalPower().
    // Sits on the right, right before its tick box.
    chip.appendChild(
      el("button", {
        class: "status-polarity-toggle " + (tag.polarity === "negative" ? "negative" : "positive"),
        title: tag.polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
        text: tag.polarity === "negative" ? "−" : "+",
        onclick: () => {
          tag.polarity = tag.polarity === "negative" ? "positive" : "negative";
          save();
          refreshTabContent();
        },
      })
    );
    // Tick sits right before the delete button, at the end of the chip.
    chip.appendChild(
      tickToggle(rollSelection.has(tag.id), t("tickActiveTagTitle"), () => {
        if (rollSelection.has(tag.id)) rollSelection.delete(tag.id);
        else rollSelection.add(tag.id);
        refreshTabContent();
      })
    );
    const trash = el("button", {
      class: "chip-trash",
      title: t("removeActiveTag"),
      "aria-label": t("removeActiveTag"),
      onclick: () => {
        showConfirmDialog(t("removeActiveTagConfirm"), () => {
          character.tags = character.tags.filter((tg) => tg.id !== tag.id);
          save();
          refreshTabContent();
        });
      },
    });
    trash.appendChild(trashIcon());
    chip.appendChild(trash);
    list.appendChild(chip);
  });

  character.statuses.forEach((s) => {
    const card = el("div", { class: "status-card " + statusColorClass });
    const topRow = el("div", { class: "status-top-row" });

    topRow.appendChild(
      el("input", {
        type: "text",
        class: "status-name-input",
        value: s.name,
        placeholder: t("statusPlaceholder"),
        oninput: (e) => { s.name = e.target.value; save(); },
      })
    );
    // Sits on the right, right before its tick box (see below).
    topRow.appendChild(
      el("button", {
        class: "status-polarity-toggle " + (s.polarity === "negative" ? "negative" : "positive"),
        title: s.polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
        text: s.polarity === "negative" ? "−" : "+",
        onclick: () => {
          s.polarity = s.polarity === "negative" ? "positive" : "negative";
          save();
          refreshTabContent();
        },
      })
    );
    // Only the single best positive and single worst negative active Status count toward Total
    // Power (per the rulebook), so ticking one un-ticks any other already-ticked Status of the
    // same polarity — radio-style, matching how the math actually works instead of letting the
    // player tick several and wonder why only one seems to count. See computeTotalPower().
    // Sits right before the delete button, at the end of the row.
    topRow.appendChild(
      tickToggle(
        rollSelection.has(s.id),
        s.polarity === "negative" ? t("tickStatusNegativeTitle") : t("tickStatusPositiveTitle"),
        () => {
          if (rollSelection.has(s.id)) {
            rollSelection.delete(s.id);
          } else {
            character.statuses.forEach((other) => {
              if (other.id !== s.id && other.polarity === s.polarity) rollSelection.delete(other.id);
            });
            rollSelection.add(s.id);
          }
          refreshTabContent();
        }
      )
    );
    const trash = el("button", {
      class: "chip-trash",
      title: t("removeStatus"),
      "aria-label": t("removeStatus"),
      onclick: () => {
        showConfirmDialog(t("removeStatusConfirm"), () => {
          character.statuses = character.statuses.filter((x) => x.id !== s.id);
          save();
          refreshTabContent();
        });
      },
    });
    trash.appendChild(trashIcon());
    topRow.appendChild(trash);
    card.appendChild(topRow);

    const boxesRow = el("div", { class: "status-boxes" });
    s.boxes.forEach((on, i) => {
      boxesRow.appendChild(
        el("button", {
          class: "status-box" + (on ? " on" : ""),
          text: String(i + 1),
          onclick: () => {
            s.boxes[i] = !s.boxes[i];
            save();
            refreshTabContent();
          },
        })
      );
    });
    card.appendChild(boxesRow);
    list.appendChild(card);
  });

  section.appendChild(list);

  // Story Tags/Statuses (GM-authored on the Scene tab, everyone else GM-only there — see
  // renderSceneTab) surface here too, right in each character's own Active Tags section, so a
  // player never has to switch tabs mid-roll to use one. Their own color (campaign.storyTagColor/
  // storyStatusColor) keeps them visually distinct from this character's personal tags/statuses
  // above. Text/severity level are read-only (span, not input; boxes not clickable) since only
  // the GM authors those — but polarity is each character's OWN choice (storyItemPolarity/
  // setStoryItemPolarity), not the GM's default, since the same scene condition can help one
  // character and hurt another (a torch helps you, blinds someone with darkvision).
  const storyTags = getStoryTags();
  if (storyTags.tags.length > 0 || storyTags.statuses.length > 0) {
    const storyTagColorClass = "color-" + campaign.storyTagColor;
    const storyStatusColorClass = "color-" + campaign.storyStatusColor;
    section.appendChild(el("label", { class: "field-label", text: t("sceneTagsTitle") }));
    const storyList = el("div", { class: "active-tags-list" });

    storyTags.tags.forEach((tag) => {
      const polarity = storyItemPolarity(character, tag);
      const chip = el("div", { class: "active-tag-chip " + storyTagColorClass });
      chip.appendChild(el("span", { class: "story-tag-text", text: tag.text || t("storyTagPlaceholder") }));
      chip.appendChild(
        el("button", {
          class: "status-polarity-toggle " + (polarity === "negative" ? "negative" : "positive"),
          title: polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
          text: polarity === "negative" ? "−" : "+",
          onclick: () => {
            setStoryItemPolarity(character, save, tag, polarity === "negative" ? "positive" : "negative");
          },
        })
      );
      chip.appendChild(
        tickToggle(rollSelection.has(tag.id), t("tickStoryTagTitle"), () => {
          if (rollSelection.has(tag.id)) rollSelection.delete(tag.id);
          else rollSelection.add(tag.id);
          refreshTabContent();
        })
      );
      storyList.appendChild(chip);
    });

    storyTags.statuses.forEach((s) => {
      const polarity = storyItemPolarity(character, s);
      const card = el("div", { class: "status-card " + storyStatusColorClass });
      const topRow = el("div", { class: "status-top-row" });
      topRow.appendChild(el("span", { class: "story-tag-text", text: s.name || t("storyStatusPlaceholder") }));
      topRow.appendChild(
        el("button", {
          class: "status-polarity-toggle " + (polarity === "negative" ? "negative" : "positive"),
          title: polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
          text: polarity === "negative" ? "−" : "+",
          onclick: () => {
            setStoryItemPolarity(character, save, s, polarity === "negative" ? "positive" : "negative");
          },
        })
      );
      // Radio-style within the story pool only — cross-pool exclusion with this character's own
      // personal Statuses isn't attempted since computeTotalPower() already takes the max across
      // both pools regardless of how many are ticked, so two simultaneously-ticked positives from
      // different pools are harmless, just not additive.
      topRow.appendChild(
        tickToggle(
          rollSelection.has(s.id),
          polarity === "negative" ? t("tickStatusNegativeTitle") : t("tickStatusPositiveTitle"),
          () => {
            if (rollSelection.has(s.id)) {
              rollSelection.delete(s.id);
            } else {
              storyTags.statuses.forEach((other) => {
                if (other.id !== s.id && storyItemPolarity(character, other) === polarity) rollSelection.delete(other.id);
              });
              rollSelection.add(s.id);
            }
            refreshTabContent();
          }
        )
      );
      card.appendChild(topRow);

      // Severity level is scene state the GM sets on the Scene tab, not something a player
      // uses/spends the way a tick is — read-only here, boxes not clickable.
      const boxesRow = el("div", { class: "status-boxes" });
      s.boxes.forEach((on, i) => {
        boxesRow.appendChild(
          el("button", { class: "status-box readonly" + (on ? " on" : ""), text: String(i + 1), disabled: "disabled" })
        );
      });
      card.appendChild(boxesRow);
      storyList.appendChild(card);
    });

    section.appendChild(storyList);
  }

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

// ---------- Scene tab (GM authors, everyone ticks) ----------
// Story Tags & Statuses represent conditions the Narrator gives the SCENE, not a character — an
// enemy's wound, a dim-light area — so they need to modify everyone's roll, not just one sheet's.
// This tab is GM-only (authoring/removal); players never open it — instead the same items surface
// directly inside each character's own Active Tags section (see renderActiveTagsSection), each
// player ticking them and choosing their own +/- there. So unlike a first pass at this feature,
// there's no tick-toggle or read-only branch here at all — every control on this tab always
// mutates the shared storyTags object, same as Company tab's GM-only textareas.

function renderSceneTab() {
  const campaign = getCampaign();
  const tagColorClass = "color-" + campaign.storyTagColor;
  const statusColorClass = "color-" + campaign.storyStatusColor;
  const { storyTags, save } = bindStoryTags();

  const wrap = el("div", { class: "section" });

  const addTagBtn = el("button", {
    class: "btn small add-btn",
    text: t("addStoryTag"),
    onclick: () => {
      storyTags.tags.push({ id: uid(), text: "", polarity: "positive" });
      save();
      refreshTabContent();
      refreshRollLogWidget(); // standalone's embedded corner widget doesn't get its own metadata-change tick
    },
  });
  const addStatusBtn = el("button", {
    class: "btn small add-btn",
    text: t("addStoryStatus"),
    onclick: () => {
      storyTags.statuses.push({ id: uid(), name: "", boxes: [false, false, false, false, false, false], polarity: "positive" });
      save();
      refreshTabContent();
      refreshRollLogWidget();
    },
  });
  wrap.appendChild(
    el("div", { class: "section-title" }, [
      el("span", { text: t("sceneTitle") }),
      el("div", { class: "title-buttons" }, [addTagBtn, addStatusBtn]),
    ])
  );
  wrap.appendChild(el("div", { class: "hint" }, t("sceneHintGm")));

  if (storyTags.tags.length === 0 && storyTags.statuses.length === 0) {
    wrap.appendChild(el("div", { class: "party-empty", text: t("sceneEmpty") }));
    return wrap;
  }

  const list = el("div", { class: "active-tags-list" });

  storyTags.tags.forEach((tag) => {
    const chip = el("div", { class: "active-tag-chip " + tagColorClass });
    chip.appendChild(
      el("input", {
        type: "text",
        value: tag.text,
        placeholder: t("storyTagPlaceholder"),
        oninput: (e) => { tag.text = e.target.value; save(); },
      })
    );
    // This is just the DEFAULT polarity a new character starts with — each player can flip their
    // own copy from their Active Tags section (see storyItemPolarity/setStoryItemPolarity).
    chip.appendChild(
      el("button", {
        class: "status-polarity-toggle " + (tag.polarity === "negative" ? "negative" : "positive"),
        title: tag.polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
        text: tag.polarity === "negative" ? "−" : "+",
        onclick: () => {
          tag.polarity = tag.polarity === "negative" ? "positive" : "negative";
          save();
          refreshTabContent();
        },
      })
    );
    const trash = el("button", {
      class: "chip-trash",
      title: t("removeStoryTag"),
      "aria-label": t("removeStoryTag"),
      onclick: () => {
        showConfirmDialog(t("removeStoryTagConfirm"), () => {
          storyTags.tags = storyTags.tags.filter((tg) => tg.id !== tag.id);
          save();
          refreshTabContent();
          refreshRollLogWidget();
        });
      },
    });
    trash.appendChild(trashIcon());
    chip.appendChild(trash);
    list.appendChild(chip);
  });

  storyTags.statuses.forEach((s) => {
    const card = el("div", { class: "status-card " + statusColorClass });
    const topRow = el("div", { class: "status-top-row" });

    topRow.appendChild(
      el("input", {
        type: "text",
        class: "status-name-input",
        value: s.name,
        placeholder: t("storyStatusPlaceholder"),
        oninput: (e) => { s.name = e.target.value; save(); },
      })
    );
    topRow.appendChild(
      el("button", {
        class: "status-polarity-toggle " + (s.polarity === "negative" ? "negative" : "positive"),
        title: s.polarity === "negative" ? t("statusPolarityNegativeTitle") : t("statusPolarityPositiveTitle"),
        text: s.polarity === "negative" ? "−" : "+",
        onclick: () => {
          s.polarity = s.polarity === "negative" ? "positive" : "negative";
          save();
          refreshTabContent();
        },
      })
    );
    const trash = el("button", {
      class: "chip-trash",
      title: t("removeStoryStatus"),
      "aria-label": t("removeStoryStatus"),
      onclick: () => {
        showConfirmDialog(t("removeStoryStatusConfirm"), () => {
          storyTags.statuses = storyTags.statuses.filter((x) => x.id !== s.id);
          save();
          refreshTabContent();
          refreshRollLogWidget();
        });
      },
    });
    trash.appendChild(trashIcon());
    topRow.appendChild(trash);
    card.appendChild(topRow);

    const boxesRow = el("div", { class: "status-boxes" });
    s.boxes.forEach((on, i) => {
      boxesRow.appendChild(
        el("button", {
          class: "status-box" + (on ? " on" : ""),
          text: String(i + 1),
          onclick: () => {
            s.boxes[i] = !s.boxes[i];
            save();
            refreshTabContent();
          },
        })
      );
    });
    card.appendChild(boxesRow);
    list.appendChild(card);
  });

  wrap.appendChild(list);
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
          showConfirmDialog(t("removeCharacterConfirm"), () => {
            updateRoster((r) => {
              const idx = r.findIndex((x) => x.id === entry.id);
              if (idx >= 0) r.splice(idx, 1);
            });
            delete roomMeta[characterKey(entry.id)];
            scheduleRoomSave(characterKey(entry.id));
            if (expandedRosterId === entry.id) expandedRosterId = null;
            refreshTabContent();
          });
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

  // A plain vertical stack, not .list-rows' masonry columns (that class packs short Backpack
  // items tightly side by side, which is right for a card grid but wrong here: it was slicing
  // each category row's flex children — color swatches, label, remove button — across column
  // boundaries whenever the window was wide enough to fit more than one 230px column, scattering
  // the ✕ button away from its own row and reordering rows top-to-bottom-then-across instead of
  // simply top to bottom. See .category-rows in style.css.
  const rows = el("div", { class: "category-rows" });
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

  wrap.appendChild(el("label", { class: "field-label", text: t("trackLabelsSettingsTitle") }));
  wrap.appendChild(el("div", { class: "hint" }, t("trackLabelsSettingsHint")));
  const trackRows = el("div", { class: "category-rows" });
  getCampaign().trackLabels.forEach((label, i) => {
    const row = el("div", { class: "category-row" });
    row.appendChild(el("span", { class: "track-order-label", text: String(i + 1) + "." }));
    row.appendChild(
      el("input", {
        type: "text",
        class: "category-label-input",
        placeholder: t("trackLabelPlaceholder"),
        value: label,
        oninput: (e) => {
          updateCampaign((camp) => { camp.trackLabels[i] = e.target.value; });
        },
      })
    );
    trackRows.appendChild(row);
  });
  wrap.appendChild(trackRows);

  const campaign = getCampaign();
  wrap.appendChild(el("label", { class: "field-label", text: t("tagColorLabel") }));
  wrap.appendChild(
    renderColorSwatchPicker(campaign.tagColor, (c) => {
      updateCampaign((camp) => { camp.tagColor = c; });
      refreshTabContent();
    })
  );
  wrap.appendChild(el("label", { class: "field-label", text: t("statusColorLabel") }));
  wrap.appendChild(
    renderColorSwatchPicker(campaign.statusColor, (c) => {
      updateCampaign((camp) => { camp.statusColor = c; });
      refreshTabContent();
    })
  );
  wrap.appendChild(el("label", { class: "field-label", text: t("storyTagColorLabel") }));
  wrap.appendChild(
    renderColorSwatchPicker(campaign.storyTagColor, (c) => {
      updateCampaign((camp) => { camp.storyTagColor = c; });
      refreshTabContent();
    })
  );
  wrap.appendChild(el("label", { class: "field-label", text: t("storyStatusColorLabel") }));
  wrap.appendChild(
    renderColorSwatchPicker(campaign.storyStatusColor, (c) => {
      updateCampaign((camp) => { camp.storyStatusColor = c; });
      refreshTabContent();
    })
  );

  return wrap;
}

// ---------- roll log corner panel ----------
// In real Owlbear this renders alone on its own tiny page (?view=rolllog, opened automatically by
// background.html into a corner-anchored popover — see manifest's background_url). In
// standalone/local-preview mode there's no OBR.popover to anchor to, so the exact same panel is
// instead embedded directly into the main page as a `position: fixed` overlay (see renderApp()).

// Per-page UI state only — not synced, resets on reload/reconnect. Starts pre-expanded when this
// page was opened via the topbar's "activate" button (rollLogOpensExpanded, from the URL — see
// openRollLogPopover); background.html's own ambient auto-open on room join omits that flag, so a
// fresh connection still starts as the small unobtrusive pill.
let rollLogExpanded = isRollLogView && rollLogOpensExpanded;

function setRollLogPopoverSize(expanded) {
  if (backend !== "obr") return; // standalone's embedded overlay just resizes itself via CSS
  const size = expanded ? rollLogExpandedSize() : rollLogCollapsedSize();
  OBR.popover.setWidth(ROLL_LOG_POPOVER_ID, size.width);
  OBR.popover.setHeight(ROLL_LOG_POPOVER_ID, size.height);
}

function toggleRollLogExpanded() {
  rollLogExpanded = !rollLogExpanded;
  setRollLogPopoverSize(rollLogExpanded);
  if (isRollLogView) renderApp();
  else refreshRollLogWidget();
}

// Re-renders just the corner widget in place, without tearing down the rest of the character
// sheet — used after a local roll/clear in standalone mode (see rollDice()/clearRollLog()) so the
// panel updates instantly instead of waiting on a remote-metadata round trip that will never come.
function refreshRollLogWidget() {
  const existing = document.getElementById("roll-log-widget");
  if (!existing) return;
  existing.replaceWith(renderRollLogPanel());
}

// One roll's row — shared between the "Last Roll" block (just the newest one) and the History
// list (everything older), so the two stay visually identical.
function buildRollLogEntryRow(entry) {
  const row = el("div", { class: "roll-log-entry" });
  const [d1, d2] = entry.dice || [0, 0];

  const topLine = el("div", { class: "roll-log-entry-top" });
  topLine.appendChild(
    el("span", {
      class: "roll-log-entry-name",
      style: "color: " + colorForCharacterId(entry.characterId),
      text: (entry.characterName || "") + ":",
    })
  );
  if (entry.timestamp) {
    topLine.appendChild(
      el("span", {
        class: "roll-log-entry-time",
        text: new Date(entry.timestamp).toLocaleTimeString(lang === "it" ? "it-IT" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })
    );
  }
  row.appendChild(topLine);

  const mathLine = el("div", { class: "roll-log-entry-math" });
  mathLine.appendChild(el("span", { text: `2d6 (${d1}+${d2}) + ` }));
  // Bold, plain black — see .roll-log-power-value in style.css for why this isn't
  // accent-colored like the sheet's own Total Power chip.
  mathLine.appendChild(el("span", { class: "roll-log-power-value", text: String(entry.power) }));
  mathLine.appendChild(el("span", { text: " = " }));
  const outcome = rollOutcome(entry.total);
  mathLine.appendChild(
    el("span", {
      class: "roll-log-total roll-log-total-" + outcome,
      title: t("rollOutcome" + outcome[0].toUpperCase() + outcome.slice(1)),
      text: String(entry.total),
    })
  );
  row.appendChild(mathLine);
  return row;
}

function renderRollLogPanel() {
  const widget = el("div", {
    id: "roll-log-widget",
    class:
      "roll-log-widget" +
      (isRollLogView ? "" : " floating") +
      (rollLogExpanded ? " expanded" : " collapsed"),
  });

  if (!rollLogExpanded) {
    const pill = el("button", {
      class: "roll-log-pill",
      title: t("expandRollLogTitle"),
      "aria-label": t("expandRollLogTitle"),
      onclick: () => toggleRollLogExpanded(),
    });
    pill.appendChild(diceIcon(15));
    widget.appendChild(pill);
    return widget;
  }

  const panel = el("div", { class: "roll-log-panel" });

  const header = el("div", { class: "roll-log-header" });
  // "Scene" is this whole always-open widget's identity now — the two sections inside (Scene Tags,
  // Roll Registry) get their own headings just below, see rollLogSectionTitle usages above/below.
  header.appendChild(el("span", { class: "roll-log-title", text: t("rollLogTitle") }));
  const headerBtns = el("div", { class: "roll-log-header-btns" });
  // Personal mute toggle — affects only this viewer's own copy of the panel (see
  // rollSoundMuted), so it's available to everyone, not just the GM.
  const muteBtn = el("button", {
    class: "icon-btn-round roll-log-mute-btn",
    title: rollSoundMuted ? t("unmuteRollSoundTitle") : t("muteRollSoundTitle"),
    "aria-label": rollSoundMuted ? t("unmuteRollSoundTitle") : t("muteRollSoundTitle"),
    onclick: () => {
      setRollSoundMuted(!rollSoundMuted);
      if (isRollLogView) renderApp();
      else refreshRollLogWidget();
    },
  });
  muteBtn.appendChild(rollSoundMuted ? soundOffIcon() : soundOnIcon());
  headerBtns.appendChild(muteBtn);
  // Clearing wipes the log for the whole table, not just the viewer's own copy — GM only, same
  // UI-level gating (not an OBR-enforced permission) as every other GM-only control in this app.
  if (isGM()) {
    const clearBtn = el("button", {
      class: "icon-btn-round roll-log-clear-btn",
      title: t("clearRollLogTitle"),
      "aria-label": t("clearRollLogTitle"),
      onclick: () => showConfirmDialog(t("clearRollLogConfirm"), () => clearRollLog()),
    });
    clearBtn.appendChild(trashIcon());
    headerBtns.appendChild(clearBtn);
  }
  const collapseBtn = el("button", {
    class: "icon-btn-round",
    title: t("collapseRollLogTitle"),
    "aria-label": t("collapseRollLogTitle"),
    onclick: () => toggleRollLogExpanded(),
  });
  collapseBtn.appendChild(collapseIcon());
  headerBtns.appendChild(collapseBtn);
  header.appendChild(headerBtns);
  panel.appendChild(header);

  // Read-only glance at whatever the GM currently has active in the scene, so a player can tell
  // "is there a story tag/status affecting my roll right now" without leaving this always-open
  // corner popover to go check the Scene tab. Deliberately NOT wired into rollSelection/tick here
  // — ticking happens from each character's own Active Tags section instead (see
  // renderActiveTagsSection), which is the one place guaranteed to be sharing that character's own
  // JS context (rollSelection is a plain in-memory Set, not synced room metadata — see its own
  // comment above — so this separate popover page couldn't tick into the same Set even if it
  // tried).
  //
  // Grows to fit every current item up to half the panel (see rollLogSceneExtraHeight, called
  // again from boot()'s OBR.room.onMetadataChange whenever the count changes while this panel is
  // expanded) — past that cap the block itself scrolls (see its CSS) rather than continuing to
  // grow and pushing the Last Roll/History block below it off the panel.
  const storyTags = getStoryTags();
  let sceneContent = null; // measured after mount below, to show/hide sceneOverflowIcon
  let sceneOverflowIcon = null;
  if (storyTags.tags.length > 0 || storyTags.statuses.length > 0) {
    const campaign = getCampaign();
    const tagColorClass = "color-" + campaign.storyTagColor;
    const statusColorClass = "color-" + campaign.storyStatusColor;
    const sceneBlock = el("div", { class: "roll-log-scene" });
    // Purely informational, not a button — lets a player know there are more Story Tags below
    // than currently fit, without them having to notice a thin scrollbar on their own. Shown/hidden
    // by actually measuring the rendered content after mount (see the requestAnimationFrame below)
    // rather than pre-computed from the tag count, since the real available height depends on
    // whatever popover box Owlbear actually granted — not something this app can predict exactly.
    sceneOverflowIcon = el("span", { class: "roll-log-scene-overflow-indicator", title: t("moreSceneTagsTitle") });
    sceneOverflowIcon.appendChild(chevronDownIcon());
    sceneBlock.appendChild(
      el("div", { class: "roll-log-subheader" }, [
        el("span", { class: "roll-log-section-title", text: t("sceneTagsTitle") }),
        sceneOverflowIcon,
      ])
    );
    sceneContent = el("div", { class: "roll-log-scene-content" });
    const sceneList = el("div", { class: "roll-log-scene-list" });
    storyTags.tags.forEach((tag) => {
      sceneList.appendChild(
        el("div", { class: "active-tag-chip compact " + tagColorClass }, [
          el("span", { class: "story-tag-text", text: tag.text || t("storyTagPlaceholder") }),
        ])
      );
    });
    storyTags.statuses.forEach((s) => {
      const level = s.boxes.lastIndexOf(true) + 1;
      sceneList.appendChild(
        el("div", { class: "active-tag-chip compact " + statusColorClass }, [
          el("span", {
            class: "story-tag-text",
            text: (s.name || t("storyStatusPlaceholder")) + (level > 0 ? " (" + level + ")" : ""),
          }),
        ])
      );
    });
    sceneContent.appendChild(sceneList);
    sceneBlock.appendChild(sceneContent);
    panel.appendChild(sceneBlock);
  }

  // "Last Roll" is the one thing here that's always visible no matter how tight space gets (see
  // .roll-log-last's flex-shrink:0 in style.css) — per the user, it's typically the only roll
  // result that actually matters moment to moment. Everything older lives behind the History
  // toggle instead of always taking up room.
  const entries = getRollLog();
  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  const olderEntries = entries.slice(0, -1);

  const lastBlock = el("div", { class: "roll-log-last" });
  const lastHeader = el("div", { class: "roll-log-subheader roll-log-last-header" });
  lastHeader.appendChild(el("span", { class: "roll-log-section-title", text: t("lastRollTitle") }));
  if (olderEntries.length > 0) {
    const historyBtn = el("button", {
      class: "icon-btn-round roll-log-history-btn" + (rollLogHistoryExpanded ? " active" : ""),
      title: rollLogHistoryExpanded ? t("hideHistoryTitle") : t("showHistoryTitle"),
      "aria-label": rollLogHistoryExpanded ? t("hideHistoryTitle") : t("showHistoryTitle"),
      onclick: () => {
        rollLogHistoryExpanded = !rollLogHistoryExpanded;
        setRollLogPopoverSize(rollLogExpanded);
        if (isRollLogView) renderApp();
        else refreshRollLogWidget();
      },
    });
    historyBtn.appendChild(clockIcon());
    lastHeader.appendChild(historyBtn);
  }
  lastBlock.appendChild(lastHeader);
  const lastContent = el("div", { class: "roll-log-last-content" });
  lastContent.appendChild(lastEntry ? buildRollLogEntryRow(lastEntry) : el("div", { class: "roll-log-empty", text: t("rollLogEmpty") }));
  lastBlock.appendChild(lastContent);
  panel.appendChild(lastBlock);

  let historyList = null;
  if (rollLogHistoryExpanded && olderEntries.length > 0) {
    historyList = el("div", { class: "roll-log-history" });
    // Oldest first, most-recently-older at the bottom — same chat-log convention as the old
    // single list, just excluding the entry already shown in "Last Roll" above.
    olderEntries.forEach((entry) => historyList.appendChild(buildRollLogEntryRow(entry)));
    panel.appendChild(historyList);
  }
  widget.appendChild(panel);

  if (historyList) {
    // Keep the most-recently-older roll in view by default. Deferred TWO frames, not one: the
    // list isn't laid out at all right after this function returns (scrollHeight on a still-
    // detached node reads 0), and one frame isn't reliably enough further when this render was
    // triggered by something that ALSO just resized the popover itself (expanding it, or toggling
    // History, both call setRollLogPopoverSize() around the same render) — the same class of bug
    // already fixed once in this codebase's history for this exact scroll-to-bottom call, by
    // nesting a second requestAnimationFrame so the measurement happens after that resize's own
    // layout has fully settled, not mid-transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        historyList.scrollTop = historyList.scrollHeight;
      });
    });
  }
  if (sceneContent && sceneOverflowIcon) {
    // Same double-deferred reasoning as historyList above.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sceneOverflowIcon.classList.toggle("visible", sceneContent.scrollHeight > sceneContent.clientHeight + 1);
      });
    });
  }

  return widget;
}

// Reads the actual game-window height and turns it into extra pixels of clearance for the
// roll-log widget — see the comment on ROLL_LOG_EXTRA_LIFT_FRACTION above. Wrapped in a try/catch
// since OBR.viewport.getHeight() is a real round trip to the host page; better to fall back to
// "just the base clearance" than let a rejected promise stop boot() from finishing.
async function computeRollLogExtraLift() {
  try {
    const h = await OBR.viewport.getHeight();
    return Math.round(h * ROLL_LOG_EXTRA_LIFT_FRACTION);
  } catch (e) {
    return 0;
  }
}

// Half the real game-window HEIGHT — how tall the Scene Tags block (see rollLogSceneExtraHeight)
// is allowed to grow before it scrolls internally. Same round-trip-to-the-host-page caveat as
// computeRollLogExtraLift above, so the same try/catch fallback shape.
async function computeRollLogSceneMaxHeight() {
  try {
    const h = await OBR.viewport.getHeight();
    return Math.round(h * 0.5);
  } catch (e) {
    return 260;
  }
}

// ---------- boot ----------

async function boot() {
  if (OBR.isAvailable) {
    backend = "obr";
    await new Promise((resolve) => OBR.onReady(resolve));
    selfId = OBR.player.id;
    selfName = await OBR.player.getName();
    selfRole = await OBR.player.getRole();

    rollLogExtraLift = await computeRollLogExtraLift();
    rollLogSceneMaxHeight = await computeRollLogSceneMaxHeight();
    if (isRollLogView) {
      // Overrides body.roll-log-view's static padding-bottom in style.css (which stays as the
      // sensible fallback for the brief instant before this resolves) now that the real,
      // screen-size-aware clearance is known. padding-right is untouched — only the bottom gap
      // scales with screen height; see the comment on ROLL_LOG_EXTRA_LIFT_FRACTION above.
      const clearance = rollLogBottomClearance() + "px";
      document.body.style.paddingBottom = clearance;
      // Also published as a custom property so .roll-log-panel's max-height (style.css) can stay
      // in lockstep with this same number — see the comment there for why the panel needs to know
      // it at all, instead of just trusting the popover box is exactly the size we asked Owlbear
      // for via rollLogExpandedSize()/setWidth/setHeight.
      document.body.style.setProperty("--roll-log-bottom-clearance", clearance);
    }

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
      // OBR hands back a freshly-deserialized object graph on EVERY call, including no-op
      // echoes of a save this very client just made — even for a key nobody actually changed.
      // Swapping `roomMeta` in on a no-op silently replaces every nested object (character,
      // company, ...) with a new-but-identical-looking instance. bindCharacter()/bindCompany()
      // reuse an existing object across renders precisely to keep a mid-flight action (an open
      // delete-confirm dialog, an in-progress edit) pointed at the live object — an unconditional
      // swap here defeats that even without a visible re-render, since renderApp() only runs
      // when `changed` is true: the mutation lands on an object roomMeta no longer references,
      // save() persists the untouched replacement, and the action silently does nothing. Only
      // replace roomMeta (and thus object identities) when the content actually differs.
      // deepEqual (not JSON.stringify) on purpose — a round-tripped object's keys aren't
      // guaranteed to come back in the same order this client built them in, which made
      // JSON.stringify comparisons spuriously report "changed" on ordinary self-echoes.
      const changed = !deepEqual(meta, roomMeta);
      if (!changed) return;
      roomMeta = meta;
      if (isEditableFocused()) {
        // Don't tear down the field the player is actively typing in — see pendingRenderAfterEdit
        // above. roomMeta is already up to date; the visual refresh just waits until they blur.
        pendingRenderAfterEdit = true;
      } else {
        renderApp();
        // A GM editing Story Tags/Statuses on the Scene tab (a different window entirely) can
        // change how many exist — re-ask the popover for its ideal size now that renderApp() has
        // rebuilt this page's own panel with the new count, so it keeps growing/shrinking to fit
        // every item with no scrolling (see rollLogSceneExtraHeight()). No-op while collapsed.
        if (isRollLogView && rollLogExpanded) setRollLogPopoverSize(true);
      }
      // Someone (possibly this same client, echoing its own save) just changed room metadata —
      // if the roll log's last entry is one we haven't announced yet, a roll genuinely happened
      // since we last checked, so play the sound. rollLogSoundReady guards against firing on the
      // very first sync after page load, before lastAnnouncedRollId has been seeded below.
      if (rollLogSoundReady) {
        const lastRoll = getRollLog().slice(-1)[0];
        if (lastRoll && lastRoll.id !== lastAnnouncedRollId) {
          lastAnnouncedRollId = lastRoll.id;
          playDiceRollSound();
        }
      }
    });
  } else {
    backend = "standalone";
    selfId = "local";
    selfName = lang === "it" ? "Anteprima locale" : "Local preview";
    selfRole = "PLAYER";
    // No OBR.viewport here — the browser's own window stands in for "the game window" outside Owlbear.
    rollLogSceneMaxHeight = Math.round(window.innerHeight * 0.5);
  }

  await loadRoomMeta();
  // Seed "already announced" with whatever roll is already at the tail of the log (if any) so
  // existing history doesn't play back on load — only rolls that land after this point should
  // make a sound.
  lastAnnouncedRollId = (getRollLog().slice(-1)[0] || {}).id || null;
  rollLogSoundReady = true;
  renderApp();
}

boot();
