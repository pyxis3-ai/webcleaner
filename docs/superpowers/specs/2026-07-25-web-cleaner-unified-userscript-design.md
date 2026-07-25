# Design: Web Cleaner — one unified userscript

**Date:** 2026-07-25
**Status:** Approved (brainstorming) — pending user spec review

## Goal

Replace the repo's four separate userscripts with a **single installable userscript**, `web-cleaner.user.js`. The user dislikes having separate files for three reasons, all of which this addresses:

1. **Too many installs** — one script to install instead of four.
2. **Repo clutter / duplication** — the plumbing duplicated across scripts (draggable button, GM-storage wrapper, hotkey handler, button CSS) is written once.
3. **Conceptually messy** — one unified thing.

This is a **behavior-preserving consolidation**, not a rewrite. Every feature keeps its current behavior, hotkey, button, menu, and settings semantics. There is exactly one intentional behavioral change (View Mode's signal spoofing mechanism — see below), and it is a strict improvement.

## Scope

**In scope — merged into `web-cleaner.user.js`:**
- Facebook Clean Feed (`facebook-clean-feed.user.js`, v3.3.1)
- YouTube Skip Ads (`youtube-skip-ads.user.js`, v1.6.1)
- Site Blocker (`site-blocker.user.js`, v1.4.1)
- View Mode Switcher (`view-mode-switcher.user.js`, v2.2.2 — currently deleted from the working tree, restored from git into the merge)

**Out of scope (hard boundaries):**
- `mobile-mode/` browser extension — it changes the request User-Agent header and the real viewport, which a userscript fundamentally cannot do. Stays a separate extension, untouched.

## Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Build approach | **Single hand-authored file, no build step** (Approach A). No Node tooling, no bundler, no committed build artifact. |
| Scope | **All four** userscripts. |
| Filename / `@name` | `web-cleaner.user.js` / **"Web Cleaner"** |
| Old files | **Delete all four**, replace with the one. |
| Tests | `node --check` + manual verification checklist. No unit-test framework (repo has none; pure helpers move over verbatim). |

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

Rationale for `@grant GM_*` over `@grant none`: Site Blocker and View Mode need GM storage + menu, which forces the whole file into the userscript-manager **sandbox**. Facebook and YouTube currently use `@grant none` (page context) but do only pure DOM work (`querySelector`, clicks, `<style>` injection, `history.replaceState`, `MutationObserver`), all of which behave identically in the sandbox. Moving them into the sandbox is safe and, as a bonus, avoids page-CSP issues that `@grant none` injection can hit.

### File layout (one IIFE)

```
(function () {
  'use strict';

  // ---- 1. CONFIG (namespaced per feature) ----
  const CONFIG = {
    facebook:    { …current FB CONFIG… },
    youtube:     { …current YT CONFIG… },
    siteBlocker: { …current Site Blocker CONFIG… },
    viewMode:    { …current View Mode CONFIG… },
  };

  // ---- 2. Shared helpers (written ONCE) ----
  const GM_OK, gGet, gSet;
  const clamp;
  function makeDraggable(btn, storeKey, onTap, opts);   // opts.longPress → View Mode long-press-for-Auto; opts.store → pluggable pos backend (default localStorage; View Mode passes GM)
  function onHotkey(spec, handler);                     // keydown listener + text-field guard, factored out
  const BUTTON_CSS;                                     // shared 40px floating-button base style
  function injectPageScript(fn, payload);               // runs fn(payload) synchronously in PAGE context at document-start

  // ---- 3. Feature modules (each a self-contained guarded function; logic copied verbatim) ----
  function initSiteBlocker() { … }
  function initViewMode()    { … }
  function initFacebook()    { … }
  function initYouTube()     { … }

  // ---- 4. Bootstrap ----
  const host = location.hostname;
  const FB_HOSTS = new Set(['www.facebook.com', 'web.facebook.com', 'm.facebook.com']);
  const YT_HOSTS = new Set(['www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
  const run = (name, fn) => { try { fn(); } catch (e) { console.warn('[' + name + ']', e); } };

  run('SiteBlocker', initSiteBlocker);   // first: may replace the page with the block screen
  run('ViewMode', initViewMode);
  if (FB_HOSTS.has(host)) run('FCF', initFacebook);
  if (YT_HOSTS.has(host)) run('YT',  initYouTube);
})();
```

### Bootstrap order

Site Blocker runs **first** because `showBlock()` replaces `document.documentElement.innerHTML` with the block screen. On a blocked page the other modules then find no feed/player and no-op. On a normal page, order is irrelevant. This matches today's (nondeterministic, separate-script) behavior but makes it deterministic.

### Isolation / robustness

Each module is invoked through `run(name, fn)` which wraps it in `try/catch`. A crash in one module (e.g. a Facebook DOM redesign throwing) cannot abort the others. This is the explicit replacement for the "separate files can't break each other" property being given up by merging. Inside each module, existing internal `try/catch` blocks (FB's `sweep`, YT's `tick`) are preserved.

## Shared helpers — what collapses

Verified byte-for-byte or near-identical duplication across the current files:

- **`makeDraggable(btn, storeKey, onTap)`** — identical in FB and YT. View Mode has a superset variant that also supports long-press (→ set mode to Auto) and stores its position in **GM** storage rather than localStorage. Unify into one `makeDraggable(btn, storeKey, onTap, opts)` where `opts` is optional: `opts.longPress = { ms, onLongPress }` (View Mode only) and `opts.store = { get, set }` (defaults to a localStorage-backed accessor; View Mode passes a GM-backed one). FB/YT pass no opts. This keeps each module's position-storage location exactly as today, so behavior stays identical.
- **`GM_OK` / `gGet` / `gSet`** — identical in Site Blocker and View Mode. One copy.
- **Hotkey handler** — the `keydown` listener (meta/ctrl/alt/shift match + `isContentEditable`/input/textarea/select guard) is structurally identical in all four. Factor into `onHotkey(spec, handler)`; each module calls it with its own `CONFIG.<feature>.toggleHotkey` and toggle function.
- **`clamp`** — identical everywhere. One copy.
- **Floating-button base CSS** — the `position:fixed;z-index:2147483647;width:40px;height:40px;border-radius:50%;…` block is shared by FB and YT (View Mode sets it inline via `Object.assign`). One shared `BUTTON_CSS` string; View Mode keeps its own color/opacity overrides.

Everything else is feature-specific and copied verbatim into its `init*()` function.

## The View Mode context split (only intentional behavioral change)

**Problem:** In the sandbox, `window`/`navigator`/`screen` are the manager's wrappers. View Mode's `Object.defineProperty` overrides on them are invisible to the page's own scripts, so the UA/touch/`matchMedia` spoof would silently do nothing (the README already documents this failure under Firefox sandboxed managers).

**Solution:** Split View Mode into two parts:

- **Sandbox part (unchanged mechanism):** compute `realMobile`, `toMobile`, `useFrame`, `mode` (these read the *true* `navigator`, which is correct — the sandbox sees the real UA). Then run `applyViewport()` (viewport `<meta>`), `applyFrame()` (frame CSS + `vm-framed` class), the button, the hotkey, and the GM menu commands — all pure DOM/GM work that already works in the sandbox.
- **Page part (new mechanism):** `spoofSignals()` + `installMatchMedia()` are injected into the **page** via a synchronous document-start `<script>` element:

  ```
  function injectPageScript(fn, payload) {
    const s = document.createElement('script');
    s.textContent = '(' + fn.toString() + ')(' + JSON.stringify(payload) + ');';
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  }
  ```

  The injected function is a self-contained copy of the current `spoofSignals`/`installMatchMedia` logic that references only its `payload` argument (`{ mode, toMobile, useFrame, cfg }`) and the page globals — no closure over the outer IIFE. Appending an inline `<script>` at `document-start` executes it synchronously in page context **before** the page's own scripts run, so the overrides land in time.

**Result:** identical behavior on phones (viewport lever), and the desktop JS-spoof now works even under sandboxed managers where it previously failed. Strict improvement.

**Caveat:** a strict site CSP that forbids inline `<script>` could block the injected spoof (the sandbox parts — viewport, frame, button — still work). This is no worse than today, where the sandbox override already failed on such setups.

## Settings & migration

The merged script is a **new install** (new `@name`/`@namespace`). GM storage is keyed per-script, so:

- **Survives** (localStorage, per-origin, shared across scripts): per-site view mode (`vm_mode`), Site Blocker snooze (`sb_snooze`), Facebook and YouTube button positions (`fcf_pos`, `yt_pos`).
- **Resets** (GM storage, per-script): Site Blocker's custom block/allow lists (`sb_custom`, `sb_allow`), its toggle states (`sb_on`, `sb_adult`, `sb_focus`, `sb_sched`), View Mode's new-site default (`vm_global`), and View Mode's button position (`vm_pos`, GM-stored — reverts to its default corner). These fall back to their `CONFIG` defaults on first run of the unified script.

Consequence for the user: after installing Web Cleaner and removing the old four, re-add any custom blocked/allowed sites once. Documented in the README migration note. No storage-migration code is written (GM storage is isolated per script; there is no clean cross-script read — not worth building for a personal repo).

Storage keys stay namespaced exactly as today (`fcf_*`, `yt_*`, `sb_*`, `vm_*`) — no collisions across modules.

## What explicitly does NOT change

- Hotkeys: `Alt+Shift+F` (FB), `Alt+Shift+Y` (YT), `Alt+Shift+B` (Site Blocker), `Alt+Shift+V` (View Mode).
- Buttons: 🧹 FB, ⏭ YT, 🖥/📱/🔄 View Mode; same IDs, same defaults (FB/YT bottom-right, View Mode bottom-left → no overlap). FB/YT positions persist as today; View Mode's saved position resets once (GM-stored) but its default corner is unchanged. Site Blocker still has no floating button.
- Site Blocker's shadow-DOM management panel, its four menu commands, and its block screen — verbatim.
- View Mode's four menu commands (per-site desktop/mobile/auto + cycle new-site default) — verbatim.
- Facebook's per-host desktop/mobile branch, sponsored detection, reel-ad skip, tracking strip, force-Most-Recent — verbatim.
- YouTube's video/Shorts ad skip, feed/banner hiding, anti-adblock dismissal — verbatim.

## Documentation changes

- **README.md:**
  - Collapse the install table to a single **Web Cleaner** row (one raw-URL install link).
  - Replace the "Why these are separate scripts" section with a short "One script, four modules" section (one install, shared plumbing once, per-module `try/catch` isolation; note that `mobile-mode` stays a separate extension by necessity).
  - Add a migration note: install Web Cleaner, then remove the old four scripts; re-add any custom Site Blocker sites once (GM settings reset).
  - Keep the controls and hotkey tables (unchanged).
- **index.html:** collapse the four userscript install cards into one Web Cleaner card (keep the Mobile Mode extension card).

## Verification plan

1. **`node --check web-cleaner.user.js`** — parses cleanly (catches merge/syntax slips). Primary automated gate.
2. **Manual checklist** (install in Violentmonkey/Tampermonkey):
   - Facebook: feed cleaned, 🧹 button toggles + drags, `Alt+Shift+F` toggles; check `m.facebook.com` branch.
   - YouTube: video ad auto-skips, ⏭ button + `Alt+Shift+Y`; feed ads hidden.
   - Site Blocker: a Focus-Pack/adult/custom site shows the block screen; panel opens (menu + block-screen ⚙), add/remove/allow works live, `Alt+Shift+B` toggles, snooze works.
   - View Mode: toggle on a responsive site and confirm in the page console that `navigator.userAgent` actually flips (validates the page-injection fix); viewport switches; button long-press → Auto; menu commands.
   - Cross-module: on facebook.com, both the FB 🧹 and View Mode buttons appear and neither breaks the other; a thrown error in one module (temporarily inject one) does not disable the others.

No unit-test framework is added: the repo has none, and the pure helpers (`norm`, `cleanUrl`, `isTrackingParam`, `inSchedule`, `cleanHost`, `matchMedia` `decide`) are copied verbatim, so their internals carry no new regression risk. The merge risk is in the wiring, which `node --check` + the manual checklist cover. Pure-helper unit tests can be added later if desired.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| FB/YT relied on page context (`@grant none`) for something beyond DOM | Audit confirms they do only DOM/`history`/`localStorage`/`MutationObserver` work — all sandbox-safe. Verify in the manual checklist. |
| View Mode page-injection blocked by strict site CSP | Sandbox parts (viewport/frame/button) still work; no worse than today's failed sandbox override. |
| One module's crash breaks the page | Per-module `try/catch` in `run()`; matches the isolation of separate files. |
| GM settings reset confuses the user on first run | Documented migration note; defaults are sensible. |
| Existing installs 404 on auto-update after old files deleted | Expected and accepted (user chose delete). Manager keeps last version until the user manually installs Web Cleaner and removes the old four. |

## Out of scope / non-goals

- No build system, bundler, or module files (Approach B was rejected).
- No storage-migration code for GM settings.
- No changes to the `mobile-mode/` extension.
- No new features — behavior-preserving consolidation only.
- No refactoring of module internals beyond extracting the five shared helpers.
