# Design: Web Cleaner — one unified userscript with a full control panel

**Date:** 2026-07-25
**Status:** Approved (brainstorming) — pending user spec review

## Goal

Replace the repo's four separate userscripts with a **single installable userscript**, `web-cleaner.user.js`, and give it **one unified in-page control panel** (opened from the userscript-manager menu) that exposes *every* interactive feature, capability, and tuning value across all four modules. The user dislikes separate files (too many installs, repo clutter/duplication, conceptually messy) and wants everything interactive reachable from the menu rather than by editing `CONFIG`.

This merges two related asks:
1. **Consolidation** — four scripts → one file, shared plumbing written once.
2. **Menu-driven control** — a single "⚙ Web Cleaner settings…" panel where every setting (feature toggles, mode selectors, site lists, schedule times, hotkeys, widths, UA strings) is editable and persisted. `CONFIG` becomes the *default schema*; runtime settings live in GM storage.

It is otherwise **behavior-preserving**: each feature keeps its current detection/DOM logic verbatim. There are three intentional behavioral changes, all improvements or consequences of the above (View Mode signal-spoof mechanism; FB/YT master-enable now persists; feature flags are now runtime-editable).

## Scope

**In scope — merged into `web-cleaner.user.js`:**
- Facebook Clean Feed (`facebook-clean-feed.user.js`, v3.3.1)
- YouTube Skip Ads (`youtube-skip-ads.user.js`, v1.6.1)
- Site Blocker (`site-blocker.user.js`, v1.4.1)
- View Mode Switcher (`view-mode-switcher.user.js`, v2.2.2 — restored from git into the merge)

**Out of scope (hard boundaries):**
- `mobile-mode/` browser extension — changes the request User-Agent header + real viewport, which a userscript cannot do. Untouched.
- No build system, bundler, or module files. No new *detection/DOM* logic — the panel controls existing behavior, it does not add new site-cleaning features.

## Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Build approach | **Single hand-authored file, no build step.** No tooling, no bundler, no committed artifact. |
| Scope | **All four** userscripts. |
| Filename / `@name` | `web-cleaner.user.js` / **"Web Cleaner"** |
| Old files | **Delete all four**, replace with the one. |
| Menu shape | **Unified in-page control panel** (generalize Site Blocker's shadow-DOM panel), opened from a menu command, plus a few quick-action menu commands. |
| Panel depth | **Everything, including tuning** — all toggles, selectors, list editors, schedule times, hotkey bindings, widths, DPR, UA strings. |
| Persistence | `CONFIG` = defaults; live settings in **GM storage**, one object per module. Edits persist immediately; reload only when the edit affects the current page. |
| Tests | `node --check` + manual checklist. No unit-test framework. |

## Architecture

### Metadata header (union of all four)

```
// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/web-cleaner
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==
```

Site Blocker and View Mode need GM storage + menu, forcing the whole file into the manager **sandbox**. Facebook and YouTube (`@grant none` today) do only pure DOM work (`querySelector`, clicks, `<style>` injection, `history.replaceState`, `MutationObserver`), all identical in the sandbox — they move in safely (and avoid page-CSP issues that `@grant none` injection can hit).

### File layout (one IIFE)

```
(function () {
  'use strict';

  // ---- 1. DEFAULTS (the CONFIG schema, namespaced per feature) ----
  const DEFAULTS = { facebook:{…}, youtube:{…}, siteBlocker:{…}, viewMode:{…} };

  // ---- 2. Settings layer ----
  const GM_OK, gGet, gSet;
  // settings.<module> = { ...DEFAULTS.<module>, ...gGet('wc_<module>', {}) }   // GM overrides defaults
  const settings = loadSettings();
  function saveModule(name);                 // gSet('wc_'+name, settings[name])
  function applyEdit(name, mutate);          // mutate(); saveModule(name); reload IF it affects THIS page, else refresh panel

  // ---- 3. Shared helpers (written ONCE) ----
  const clamp;
  function makeDraggable(btn, storeKey, onTap, opts);   // opts.longPress → View Mode long-press-for-Auto; positions in localStorage
  function onHotkey(getSpec, handler);                  // keydown listener + text-field guard; reads the CURRENT binding each event
  const BUTTON_CSS;                                     // shared 40px floating-button base style
  function injectPageScript(fn, payload);               // runs fn(payload) synchronously in PAGE context at document-start
  const Panel = { open, close, render, … };             // the shared control-panel component (§ Control panel)

  // ---- 4. Feature modules (each a guarded function; detection/DOM logic verbatim, reading settings.<module>) ----
  function initSiteBlocker() { … }
  function initViewMode()    { … }
  function initFacebook()    { … }
  function initYouTube()     { … }

  // ---- 5. Menu commands ----
  function registerMenu();   // defines "⚙ Web Cleaner settings…" + quick actions (§ Menu); called in bootstrap

  // ---- 6. Bootstrap ----
  const host = location.hostname;
  const FB_HOSTS = new Set(['www.facebook.com','web.facebook.com','m.facebook.com']);
  const YT_HOSTS = new Set(['www.youtube.com','m.youtube.com','music.youtube.com']);
  const run = (name, fn) => { try { fn(); } catch (e) { console.warn('['+name+']', e); } };

  run('SiteBlocker', initSiteBlocker);   // first: may replace the page with the block screen
  run('ViewMode', initViewMode);
  if (FB_HOSTS.has(host)) run('FCF', initFacebook);
  if (YT_HOSTS.has(host)) run('YT',  initYouTube);
  registerMenu();
})();
```

**Isolation:** every module runs through `run(name, fn)` (try/catch), so one site's DOM redesign crashing a module can't abort the others — the explicit replacement for the "separate files can't break each other" property. Existing internal try/catch (FB `sweep`, YT `tick`) preserved.

**Bootstrap order:** Site Blocker first (its `showBlock()` replaces `document.documentElement.innerHTML`); other modules then no-op on a blocked page.

## Settings layer & persistence

`DEFAULTS` (the former `CONFIG`) is the schema and fallback. At load, each module's live settings are `{ ...DEFAULTS.<module>, ...gGet('wc_<module>', {}) }`. Modules read from `settings.<module>.*`. Because edits persist then reload when they affect the current page, derived structures (FB's `INCLUDE_MARKS`/`EXACT_MARKS`, injected CSS strings) are simply recomputed from `settings` at init on the next load — no fragile live re-wiring.

**GM storage (global, per-script; resets to defaults on the new install):** one object per module.

- `wc_facebook` = `{ enabled, hideSponsored, hideSuggested, hidePeopleYouMayKnow, hideReelsTrays, stripTracking, hideRightSidebar, hideLeftSidebar, hideComposer, hideTopBar, skipReelsAds, forceMostRecent, showToggleButton, extraJunkPhrases[], toggleHotkey{} }`
- `wc_youtube` = `{ enabled, skipVideoAds, skipShortsAds, hideFeedAds, hideBanners, muteAds, dismissAntiAdblock, showToggleButton, toggleHotkey{} }`
- `wc_siteBlocker` = `{ enabled, blockAdult, blockFocus, scheduleOn, snoozeMinutes, schedule{days,from,to}, custom[], allow[], toggleHotkey{} }`
- `wc_viewMode` = `{ newSiteDefault, showButton, spoofUA, spoofTouch, spoofMedia, frameOnDesktop, longPressMs, desktopWidth, mobileWidth, mobileHeight, mobileDpr, mobileUA, desktopUA, toggleHotkey{} }`

**localStorage (per-origin; survives the switch):** ephemeral / per-site state only — `vm_mode` (per-site view mode), `sb_snooze` (snooze-until), and button positions `fcf_pos` / `yt_pos` / `vm_pos` (all three now localStorage; `makeDraggable` is a single plain implementation).

**`applyEdit(name, mutate)`** persists a change, then reloads the page only if it changes what the current page shows right now:
- FB/YT edits → reload iff the current host is that module's host.
- Site Blocker edits → reuse its existing before/after `blockReason()` check (reload iff this page's blocked-state flips).
- View Mode edits → reload iff View Mode is active on this site (`mode !== 'auto'`).
- Hotkey rebinds → **no reload**; `onHotkey` reads the current binding on each event, so it's live.
- Pure-default fields with no current-page effect (e.g. `newSiteDefault`, `snoozeMinutes`) → persist + refresh panel only.

## Control panel (the shared UI component)

Generalize Site Blocker's shadow-DOM panel into a reusable `Panel` that renders a **"Web Cleaner"** dialog with one collapsible `<details>` section per module. Reuses Site Blocker's existing switch component, list editor, `esc`/`cleanHost` helpers, and shadow-DOM isolation (`:host{all:initial}`).

**Each module section** shows its master enable + common toggles up front, and an **"Advanced"** nested `<details>` holding tuning fields — so the panel is complete without being overwhelming.

- **Facebook:** master enable; toggles for hideSponsored / hideSuggested / hidePeopleYouMayKnow / hideReelsTrays / hideRightSidebar / hideLeftSidebar / hideComposer / hideTopBar / stripTracking / skipReelsAds / forceMostRecent / showToggleButton; a list editor for `extraJunkPhrases`. Advanced: hotkey rebind.
- **YouTube:** master enable; toggles for skipVideoAds / skipShortsAds / hideFeedAds / hideBanners / muteAds / dismissAntiAdblock / showToggleButton. Advanced: hotkey rebind.
- **Site Blocker:** the existing panel content — blocking/adult/focus/schedule switches, "my blocked sites" + "allowed" list editors, built-in Focus/Adult packs. Advanced: schedule days + from/to time inputs, snooze-minutes number field, hotkey rebind. (Today's panel shows schedule times read-only; they become editable.)
- **View Mode:** per-site mode selector (Desktop / Mobile / Auto); new-site default selector; toggles for spoofUA / spoofTouch / spoofMedia / frameOnDesktop / showButton. Advanced: desktopWidth / mobileWidth / mobileHeight / mobileDpr number fields, mobileUA / desktopUA text fields, longPressMs, hotkey rebind.

**Controls & validation:**
- **Switches** — the existing `.sw` toggle.
- **Number/text fields** — `<input>` inside shadow DOM; validate on commit (positive integers for widths/DPR/snooze/longPressMs; non-empty for UA strings); invalid input reverts to the stored value.
- **Time fields** — `<input type="time">` for schedule from/to (HH:MM).
- **List editors** — Site Blocker's existing add/remove pattern, reused for blocked sites, allowed sites, and FB extra-junk phrases.
- **Hotkey rebind** — a "Press keys…" button that captures the next `keydown`, records `{ctrl, alt, shift, key}`, and requires at least one modifier (Alt/Ctrl/Shift; Meta disallowed, matching "never Cmd/Ctrl"). No hard conflict prevention across features; if two are set identically both fire (acceptable).

Every control routes through `applyEdit(module, mutate)`.

**Opening the panel:** the menu command "⚙ Web Cleaner settings…" (on every page); Site Blocker's block screen keeps its "⚙ Manage" button (now opens the full panel). Floating buttons keep tap = toggle their own feature (unchanged).

## Menu commands

The manager menu lists, for the one script:
- **⚙ Web Cleaner settings…** → opens the panel.
- Quick actions (frequent, avoid opening the panel): **toggle Facebook clean feed**, **toggle YouTube skip-ads**, **toggle blocking**, **➕ block this site**, **➖ allow this site**, **View: Desktop / Mobile / Auto (this site)**.

This puts every interactive capability one or two clicks from the menu, with the panel as the exhaustive surface.

## The View Mode context split (behavioral change #1)

In the sandbox, `window`/`navigator`/`screen` are the manager's wrappers, so View Mode's `Object.defineProperty` overrides are invisible to page scripts (the README documents this failing under Firefox sandboxed managers). Fix: compute `realMobile`/`toMobile`/`useFrame`/`mode` in the sandbox (they read the true `navigator`), then inject only `spoofSignals` + `installMatchMedia` into the **page** as a synchronous document-start `<script>`:

```
function injectPageScript(fn, payload) {
  const s = document.createElement('script');
  s.textContent = '(' + fn.toString() + ')(' + JSON.stringify(payload) + ');';
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}
```

The injected function references only its `payload` (`{ mode, toMobile, useFrame, cfg }`) and page globals — no closure over the IIFE. Appending an inline `<script>` at document-start runs it in page context before the page's own scripts. Viewport meta, frame CSS, button, hotkey, and menu stay in the sandbox. Result: identical on phones; the desktop JS-spoof now works even under sandboxed managers. **Caveat:** a strict inline-script CSP could block the injected spoof (sandbox parts still work) — no worse than today.

## Behavioral changes (all intentional)

1. **View Mode signal spoof** now runs via page injection (above) — strict improvement.
2. **FB/YT master enable persists.** Today the button/hotkey toggle is per-page only. Now button, hotkey, and panel switch all read/write `settings.<module>.enabled` (GM), so the state sticks across reloads — consistent with Site Blocker/View Mode.
3. **Feature flags are runtime-editable** via the panel (previously CONFIG-only). Changing one persists and reloads only if it affects the current page.

## What does NOT change

- Hotkey **defaults**: `Alt+Shift+F/Y/B/V` (now rebindable in the panel).
- Buttons: 🧹 FB, ⏭ YT, 🖥/📱/🔄 View Mode; same IDs, same defaults (FB/YT bottom-right, View Mode bottom-left → no overlap); tap = toggle. Site Blocker still has no floating button.
- All detection/DOM logic verbatim: FB's per-host branch, sponsored detection, reel-ad skip, tracking strip, force-Most-Recent; YT's video/Shorts skip, feed/banner hiding, anti-adblock dismissal; Site Blocker's block screen + schedule + packs; View Mode's viewport/frame/matchMedia logic.

## Settings & migration

The merged script is a **new install** (new `@name`/`@namespace`). GM storage is per-script, so on first run every `wc_<module>` object is absent and falls back to `DEFAULTS` — behavior identical to the old scripts' defaults. **localStorage survives** (per-origin): per-site view mode, snooze, button positions. Consequence: after installing Web Cleaner and removing the old four, re-add any custom blocked/allowed sites and re-apply any non-default settings once. Documented in the README migration note. No migration code (GM storage is isolated per script; not worth building for a personal repo).

## Phased implementation (to guide the plan)

1. **Merge** the four modules verbatim into one file with shared helpers (`clamp`, `makeDraggable`, `onHotkey`, `BUTTON_CSS`, `injectPageScript`) + guarded bootstrap. Behavior-preserving; still CONFIG-driven. Verify with `node --check` + manual pass.
2. **View Mode context split** — move `spoofSignals` to page injection.
3. **Settings layer** — `DEFAULTS` + `settings` load/merge + `saveModule` + `applyEdit`; modules read `settings.<module>`; master enables persist.
4. **Control panel** — generalize Site Blocker's panel into `Panel`; add all module sections, Advanced tuning, list editors, hotkey capture, validation.
5. **Menu** — "⚙ Web Cleaner settings…" + quick actions.
6. **Docs** — README (single install + "one script, four modules" + migration note), `index.html` (one install card).

## Verification plan

1. **`node --check web-cleaner.user.js`** — parses cleanly. Primary automated gate.
2. **Manual checklist** (install in Violentmonkey/Tampermonkey):
   - FB: feed cleaned, 🧹 button + `Alt+Shift+F`; `m.facebook.com` branch.
   - YT: video ad auto-skips, ⏭ button + `Alt+Shift+Y`; feed ads hidden.
   - Site Blocker: a Focus/adult/custom site shows block screen; panel add/remove/allow live; snooze; toggle.
   - View Mode: toggle a responsive site, confirm in the page console `navigator.userAgent` actually flips (validates injection); viewport switches; long-press → Auto.
   - **Panel:** every section renders; toggling a flag persists + reloads-when-relevant; number/time/UA validation rejects bad input; hotkey capture rebinds and the new binding fires; list editors add/remove; panel opens from menu and from the block screen.
   - **Persistence:** set a few non-defaults, reload, confirm they stick; master-enable off persists across reload.
   - **Isolation:** a thrown error injected into one module does not disable the others.

No unit-test framework: the repo has none, detection logic is copied verbatim, and the code is almost entirely live-DOM. Pure-helper tests can be added later if desired.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| FB/YT relied on page context (`@grant none`) beyond DOM | Audit confirms DOM/`history`/`localStorage`/`MutationObserver` only — sandbox-safe. Verify manually. |
| View Mode page-injection blocked by strict CSP | Sandbox parts (viewport/frame/button) still work; no worse than today. |
| Panel is large — regressions in reused Site Blocker panel logic | Build in Phase 4 on top of a verified merge; reuse the existing panel code as-is for the Site Blocker section, extend for others. |
| Hotkey capture edge cases (modifier-only, conflicts, typing hijack) | Require ≥1 modifier, disallow Meta, keep the input-field guard; allow (don't police) duplicate bindings. |
| One module's crash breaks the page | Per-module `try/catch` in `run()`. |
| GM settings reset on install confuses the user | Documented migration note; defaults are sensible. |
| Old installs 404 on auto-update after deletion | Expected/accepted; reinstall Web Cleaner once, remove old four. |

## Out of scope / non-goals

- No build system, bundler, or module files.
- No storage-migration code.
- No changes to `mobile-mode/`.
- No new detection/DOM cleaning features — the panel controls existing behavior only.
- No refactoring of module internals beyond the settings-read indirection and the shared helpers.
