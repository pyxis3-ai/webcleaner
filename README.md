# Web Cleaner

A browser userscript for a cleaner, ad-free, more focused web — built and verified against the live 2026 Facebook and YouTube DOM.

**Current version: 8.2.0** · [Changelog](#changelog) · [Limits](#limits--what-it-cannot-do)

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click **[Install](https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js)** — the manager will prompt you.
3. Updates are automatic: your manager re-fetches from the URL it was installed from. No re-pasting.

## One script, four modules

Each module runs inside its own error boundary, so one site's redesign breaking a module can't take down the others. Shared plumbing — the draggable button, storage, hotkeys, and the settings panel — is written once.

| Module | What it does |
|---|---|
| **Facebook Clean Feed** | Hides Sponsored posts, Suggested, People-you-may-know, Stories and Reels trays, both sidebars, the composer and the top bar. Auto-skips sponsored Reels. Strips UTM/tracking parameters and unwraps `l.php` redirects. Widens the feed into the space freed by the hidden sidebars. Forces the chronological "Most Recent" feed. Works on desktop **and** mobile web. |
| **YouTube Skip Ads** | Auto-skips and mutes video ads, skips sponsored Shorts, hides feed/banner/overlay ads, dismisses the anti-adblock popup. Optional distraction-free watch page: hide recommendations, comments, chips, merch/promo shelves and live chat, with the player widened into the reclaimed space. Desktop, `m.youtube.com` and YouTube Music. |
| **Site Blocker** | Adult filter (on by default) plus an opt-in "Focus Pack" of distracting sites, custom block/allow lists, a schedule window, and a snooze. |
| **View Mode Switcher** | Force Desktop or Mobile rendering per site, with an optional centred phone-width frame on desktop. |

Everything is configurable from one in-page panel — open **⚙ Web Cleaner** from your userscript-manager menu, or tap the 🧼 button.

## Controls

| Layer | Where |
|---|---|
| **⚙ Web Cleaner** panel | Every toggle, list, schedule, hotkey and tuning value — saved to your manager's storage, no file editing |
| Toggle hotkeys | Per module (below), all rebindable in the panel |
| Draggable on-page button | 🧼 panel · 🧹 Facebook · ⏭ YouTube · 🖥/📱/🔄 View Mode. Remembers its position; dragging never triggers the button |
| Manager menu | Panel + quick actions: toggle Facebook/YouTube/blocking, block or allow this site, switch View mode |

| Shortcut | Action |
|---|---|
| `Alt+Shift+F` | Facebook clean feed — toggle |
| `Alt+Shift+Y` | YouTube ad-skipping — toggle |
| `Alt+Shift+B` | Site Blocker — toggle all blocking (works on the block screen too) |
| `Alt+Shift+V` | View Mode — switch Desktop ⇄ Mobile (long-press the button to reset to Auto) |

Shortcuts ignore typing in text fields and never use Cmd/Ctrl.

Site Blocker deliberately has no floating button — it matches every page on the web, so its controls live in the manager menu, the hotkey, the panel, and the block screen itself.

## Behaviour notes

- **Settings & auto-updates.** Every setting lives in the panel and is saved to your manager's storage, so you never edit the script file and auto-updates keep working. Settings are stored under the `wc7_` prefix and survive version upgrades. Import/Export/Reset are in the panel's ⚙ section; imported files are type-checked and sanitised.
- **Focus Pack is opt-in.** `Focus` and `Schedule` are both **OFF by default** — nothing in the Focus Pack is blocked until you turn one on. Two independent switches feed the same filter (`Focus` blocks always, `Schedule` only inside its window), so the Blocker section shows a live **effective state** line: `● Focus pack BLOCKING NOW (inside schedule 09:00–18:00)` or `○ Focus pack not blocking (outside schedule …)`, and flags when the site you are on is one of them. **Upgrading keeps your saved settings** — if `Schedule` was on it stays on, and the state line now makes that visible.
- **Degradation is visible, not silent.** If Facebook or YouTube rotate their markup and filtering stops matching, the panel shows a warning line and the affected module's button gets an amber ring. The check is precise: if hiding is working, no sponsored label is ever visible, so any visible one is a genuine miss. It never guesses at hiding things.
- **Widen feed.** Hiding both sidebars reclaims roughly half a desktop window, so the feed widens to fill it (default 1100px; tune under Facebook → Advanced → **Feed max width**, or switch **Widen feed** off for Facebook's native 680px). Wider columns letterbox tall images — lower the value if you scroll a lot of portrait media.
- **Distraction-free watch page.** `Related`, `Comments`, `Chips`, `Merch/promos` and `Live chat` each hide that part of the YouTube watch page. `Related` is ON by default; with `Widen player` the video expands into the reclaimed space (measured 996×560 → 1385×779 at 1440px).
- **Facebook mobile.** A logged-in phone is served the responsive `www.facebook.com`, *not* `m.facebook.com`, so the module picks its code path by inspecting the markup rather than the hostname. If something slips through, add markers under **Extra junk phrases**.
- **Site Blocker** needs Tampermonkey or Violentmonkey (GM storage + menu). The snooze applies to every filter, adult included. For comprehensive adult blocking across all browsers and apps, pair it with a DNS family filter (Cloudflare `1.1.1.3` or NextDNS) — a userscript can't enumerate the whole category.
- **YouTube ads** are skipped after they're requested. For network-level blocking, pair with uBlock Origin. Note that YouTube deliberately serves playback errors ("Something went wrong. Refresh or try again later.") to users it detects as ad-blocking — if you see that repeatedly, it is usually a network-level blocker being detected, not this script. Toggling **Anti-AB** off will show you YouTube's real message.

## Limits — what it cannot do

- **Server-side ad stitching.** YouTube bakes some ads into the video stream itself. No client-side script can remove those.
- **In-video sponsor segments.** Creator read-outs ("this video is sponsored by…") are not ads in the DOM sense; use SponsorBlock for those.
- **User-Agent headers.** View Mode spoofs only what page JavaScript reads (UA, touch, `matchMedia`). No userscript can change the request's UA header or the real window width, so server-decided sites and pure CSS `@media` sites won't switch. On a phone, "Desktop" *does* work — via the viewport meta, the correct lever there.
- **`matchMedia` change events.** The spoof returns a stub; sites that react to media-query *change* events won't respond.
- **Strict Trusted Types sites.** If a site's CSP blocks the script's Trusted Types policy, the settings panel cannot be rendered at all (no string-to-DOM path exists under enforcement). The script detects this, shows a small notice pointing at the manager menu and hotkeys, and makes sure the panel host never blocks clicks. Everything else keeps working.
- **Substring matching.** Facebook splits the "Sponsored" label across text nodes, so detection must use substring matching — which means text containing "sponsored" as a substring (e.g. "unsponsored") can be hidden. Exact matching was tested and caught 0 of 2 real ads, so this trade is deliberate.
- **Schedule day-spill.** A schedule of `Mon` `22:00–06:00` does not block Tuesday 02:00.
- **Markup rotation.** Meta and Google change markup without notice. Detection degrades to "nothing hidden" rather than breaking pages, and the panel tells you when it happens.

## Changelog

### 8.2.0

**Fixes**

- **Mobile YouTube ad-skipping never worked.** The skip button is found and enabled, but `element.click()` is ignored on `m.youtube.com` — a 72-second ad ran to completion, merely muted. Because the button *was* found, the existing seek fallback never fired either. Added a full pointer/touch tap sequence plus a seek fallback after 3 ticks, so an unresponsive button can no longer keep an ad on screen.
- **`frameOnDesktop` could never work.** The UA spoof ran first, so the "are we on a real phone?" check read the *spoofed* mobile UA and disabled the desktop phone-frame. With `spoofUA` on — the default — the whole feature was dead code. Real-device detection is now captured once before any spoofing.
- **Trusted Types could leave a dead overlay.** Where a site's CSP blocks the script's policy, the panel rendered empty inside a full-screen host with `pointer-events:all` — an invisible click trap with no way to dismiss it. Now degrades to a small dismissible notice, with the host set to `pointer-events:none` so the page stays usable.
- **Two stale Facebook selectors.** `hideComments` and `hideLikeCounts` matched nothing — wrong `[role="article"]` scoping (real posts are plain divs) plus renamed labels. Now `[aria-label="Leave a comment"]` and `[aria-label^="Like:"]`.
- **Site modules ran on the block page.** After the blocker replaced the document, the Facebook module still fired its "Most Recent" redirect, so the block screen flashed and navigated away; both modules also installed observers and intervals on a page that is only a block notice.

**Added**

- Distraction-free YouTube watch page: hide Related, Comments, Chips, Merch/promos and Live chat, with `Widen player` expanding the video into the reclaimed space.
- **Visible degradation warning.** If markup rotation stops filtering from matching, the panel says so and the module's button gets an amber ring — instead of failing silently. It only fires when the relevant module and its hiding option are actually on.
- Focus Pack **effective-state** line in the Blocker panel.

**Changed**

- `scheduleOn` now defaults to **off**, so a fresh install no longer blocks Facebook and YouTube during work hours while the Focus toggle reads OFF. Existing installs keep their saved value; the new state line makes an inherited `on` visible.
- `hideEndCards`, `hideInfoCards` and `hideRelated` now default on.
- README rewritten with a full feature reference, limits and this changelog.

### 8.1.0

- **Ad-player detection corrected against a captured live ad**: the ad player is `getPresentingPlayerType() === 2`, not 3, and `getAdState()` stays at `-1` throughout an ad, so it is useless as a signal. Shorts ads are in-feed slots and detect through a different branch again.
- Mobile YouTube ad selectors corrected by reverse-engineering the shipped bundle — `ytm-companion-slot`, not `…-renderer` — and `ad-disclosure-banner-view-model` added. Several dead player selectors removed, and `.ytp-skip-ad-button` restored after it turned out to be present in both player bundles.
- **Storage hardening.** Import is key-filtered, type-checked and array-sanitised: a hostile file previously replaced the config object's prototype, and a type mismatch crashed the blocker inside an unguarded interval. `GM_getValue` is wrapped so a throwing manager cannot kill the script.
- **Schedule parsing** now fails closed — a malformed time produced `NaN` and silently blocked the site all day.
- **Block screen under Trusted Types** rebuilt from DOM nodes instead of `innerHTML`, which threw after `window.stop()` and failed *open*.
- Duplicate `<style>` elements on repeat calls; cluster drag triggering buttons; the View Mode button making the cluster undraggable; `exportSettings` failing in Firefox; an unthrottled full-document query per mutation.
- **`@version` had been frozen across four releases**, so auto-update would not have delivered any of the above.

### 8.0.0

- **Fixed the two root causes of sponsored posts still appearing.** On desktop, the feed-container scan only looked 1–2 levels deep while the real container sits at depth 5–8, so nothing was ever filtered. On mobile, the code path was gated on the `m.facebook.com` hostname — but a logged-in phone is served `www.facebook.com`, so the mobile code was dead on every real device. Layout is now detected from the markup.
- Posts are re-checked when their content changes, instead of being marked permanently clean after 4 sweeps (Facebook injects labels lazily).
- Feed widening to reclaim the space freed by hidden sidebars; panel widened with an auto-fitting toggle grid.
- **Removed the Instagram, X/Twitter and Reddit modules.** Their selectors were largely stale and they are no longer maintained. Those domains remain in the Site Blocker's Focus Pack, which is a separate feature.
- Various YouTube selector corrections and dead-selector removal.

### 7.1.0

- Anti-adblock dialog dismissal tracked per node, so it stops re-triggering `play()` on a video you paused deliberately.
- Ad detection requires actual ad UI to be present, preventing ordinary videos being seeked to the end.
- Ranked candidate selectors for the mobile Facebook feed.

## Verification

Behaviour in this project is verified against live sites rather than assumed. The 8.1.0 work was checked against:

- Real served ads on YouTube desktop, `m.youtube.com`, Shorts, and Facebook Reels — detection, skip, and return to content.
- A logged-in Facebook session, desktop and mobile, for feed filtering.
- **Chromium, Firefox and WebKit** (Safari's engine).
- Sites with Trusted Types enforced, both with the policy allowed and blocked.
- A userscript manager environment with `GM_*` present, including storage precedence and menu registration.
- AST analysis (28 regex literals, no duplicate keys, no unreachable code) and byte-level checks (no BOM, no CRLF, no invisible characters).

## Contributing

Issues, ideas, and PRs are welcome — keep PRs focused on a single concern and follow the existing conventions. The script is deliberately comment-free; put reasoning in commit messages.

## Support & sponsors

Web Cleaner is free and has no tracking or ads. If it's useful to you, you can support continued development — pay what you like, once or monthly:

<p align="center">
  <a href="https://donate.stripe.com/3cI6oI7Gh1PG0eV8MJ5kk00"><img src="https://img.shields.io/badge/%20Donate%20once-pay%20what%20you%20like-635bff?logo=stripe&logoColor=white" alt="Donate once via Stripe" height="30" /></a>
  &nbsp;
  <a href="https://buy.stripe.com/00wbJ2f8J51S9Pv1kh5kk01"><img src="https://img.shields.io/badge/%20Sponsor%20monthly-recurring-56c4e6?logo=stripe&logoColor=white" alt="Sponsor monthly via Stripe" height="30" /></a>
</p>
