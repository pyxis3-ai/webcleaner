# Web Cleaner

A browser userscript for a cleaner, ad-free, more focused web — built and verified against the live 2026 Facebook and YouTube DOM.

**Current version: 8.6.0** · [Changelog](#changelog) · [Limits](#limits--what-it-cannot-do)

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click **[Install](https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js)** — the manager will prompt you.
3. Updates are automatic: your manager re-fetches from the URL it was installed from. No re-pasting.

## One script, five modules

Each module runs inside its own error boundary, so one site's redesign breaking a module can't take down the others. Shared plumbing — the draggable button, storage, hotkeys, and the settings panel — is written once.

| Module | What it does |
|---|---|
| **Facebook Clean Feed** | Hides Sponsored posts, Suggested, People-you-may-know, Stories and Reels trays, both sidebars, the composer and the top bar. Auto-skips sponsored Reels. Strips UTM/tracking parameters and unwraps `l.php` redirects. Widens the feed into the space freed by the hidden sidebars. Forces the chronological "Most Recent" feed. Works on desktop **and** mobile web. |
| **YouTube Skip Ads** | Auto-skips and mutes video ads, skips sponsored Shorts, hides feed/banner/overlay ads, dismisses the anti-adblock popup. Optional distraction-free watch page: hide recommendations, comments, chips, merch/promo shelves and live chat, with the player widened into the reclaimed space. Desktop, `m.youtube.com` and YouTube Music. |
| **Site Blocker** | Adult filter (on by default) plus an opt-in "Focus Pack" of distracting sites, custom block/allow lists, a schedule window, and a snooze. |
| **LinkedIn** | Hides Promoted posts and Suggested content, plus the top bar and both side rails, and widens the feed into the reclaimed space. Uses no CSS selectors — LinkedIn hashes its class names — so it matches on rendered text and identifies rails by geometry. |
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
| `Alt+Shift+L` | LinkedIn — toggle |
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
- **YouTube ads** are skipped after they're requested. YouTube's detection reportedly looks for ad slots that loaded but never played and for timing anomalies — which is what seeking past an unskippable ad looks like. See `Seek past ads` in the changelog if you hit playback errors. Note also that full uBlock Origin is disabled on stable Chrome since v138 and its store listing is removed on 31 August 2026, so a Chrome + uBlock pairing is ending; desktop Firefox remains the capable option. For network-level blocking, pair with uBlock Origin. Note that YouTube deliberately serves playback errors ("Something went wrong. Refresh or try again later.") to users it detects as ad-blocking — if you see that repeatedly, it is usually a network-level blocker being detected, not this script. Toggling **Anti-AB** off will show you YouTube's real message.

### Facebook surface coverage

Verified against a live logged-in session. "Feed model" means posts are a vertical list whose header carries the label; "tile grid" means a grid of cards, which the current detector does not model.

| Surface | Mobile | Desktop | Notes |
|---|---|---|---|
| Main feed | ✅ | ✅ | Verified: sponsored, Suggested, People-you-may-know, Reels/Stories trays |
| Reels | ✅ | ✅ | Skips sponsored reels and advances. Mobile was broken before 8.2.2 |
| Watch | ✅ | ✅ | Facebook now redirects `/watch` to `/reel/`, so Reels handling covers it |
| Groups feed & individual groups | ✅ | ✅ | Verified: container found, post headers read correctly |
| Marketplace | ✅ | ✅ | Mobile via the post matcher; desktop via tile-grid detection added in 8.2.3 |
| Stories viewer | ❌ | ❌ | Not covered. The Stories *tray* on the feed is hidden by `Reels/Stories` |
| Search, Videos, Events, Gaming, Profile | ✅ | ✅ | Covered by tile-grid detection wherever ads render as labelled cards |

## Limits — what it cannot do

- **Server-side ad stitching.** YouTube bakes some ads into the video stream itself. No client-side script can remove those.
- **In-video sponsor segments.** Creator read-outs ("this video is sponsored by…") are not ads in the DOM sense; use SponsorBlock for those.
- **User-Agent headers.** View Mode spoofs only what page JavaScript reads (UA, touch, `matchMedia`). No userscript can change the request's UA header or the real window width, so server-decided sites and pure CSS `@media` sites won't switch. On a phone, "Desktop" *does* work — via the viewport meta, the correct lever there.
- **`matchMedia` change events.** The spoof returns a stub; sites that react to media-query *change* events won't respond.
- **Strict Trusted Types sites.** If a site's CSP blocks the script's Trusted Types policy, the settings panel cannot be rendered at all (no string-to-DOM path exists under enforcement). The script detects this, shows a small notice pointing at the manager menu and hotkeys, and makes sure the panel host never blocks clicks. Everything else keeps working.
- **Substring matching.** Facebook splits the "Sponsored" label across text nodes, so detection must use substring matching — which means text containing "sponsored" as a substring (e.g. "unsponsored") can be hidden. Exact matching was tested and caught 0 of 2 real ads, so this trade is deliberate.
- **Schedule day-spill.** A schedule of `Mon` `22:00–06:00` does not block Tuesday 02:00.
- **Markup rotation.** Meta and Google change markup without notice. Three things happen: the panel warns you, the module button gets an amber ring, and a rendered-text fallback engages that recovers some ads without depending on markup. Recovery is partial by design — the fallback is bounded and hides only the tightest element containing a visible sponsored label, so it never risks the page. Full coverage returns when selectors are updated.

## Changelog

### 8.6.0

- **LinkedIn brought to parity with Facebook and YouTube.** Added `Top bar`, `L.rail`, `R.rail` and `Widen feed` (with a `Feed max width` under Advanced), alongside the existing Promoted and Suggested toggles. LinkedIn hashes its class names, so the rails are identified by geometry relative to the feed column rather than by selector — the same approach Facebook uses for its left nav. Verified on a live feed with a clean baseline: both rails tagged (216px left, 312px right), both hidden, top bar hidden, feed widened 552 → 900px, and feed content intact. All three site modules now have identical wiring — panel section, GM menu entry, hotkey, cluster button, `affects()` handling and enabled-toggle branch.

### 8.5.2

- **Fixed: promoted posts stayed visible while scrolling LinkedIn.** LinkedIn scrolls an inner container (`main#workspace`), not the window, so the module's `window` scroll listener never fired and sweeps fell back to the 1.5s timer — which you outscroll. Measured on the live feed: scrolling that container produced **0 window scroll events and 7 capture-phase events**. Both Facebook and LinkedIn now also listen in the capture phase on `document`, which catches scrolling from any container. The detection itself was never at fault: once a promoted post was in view, the existing sweep hid it correctly.

### 8.5.1

- **Fixed a hole in all three tightest-match scanners** (LinkedIn, the Facebook tile-grid pass, and the rotation fallback). Each skipped a matching element if one of its children also matched — correct, so a row is never hidden for one ad tile. But the child test only checked width and minimum height, while the main loop also enforces a maximum height and a viewport band. So an oversized or off-screen matching child would suppress its parent and then be rejected itself, and **neither was hidden**. Proven on a fixture: a 718px card containing a 2000px matching child was missed by the old logic and is caught by the new. A child now only suppresses its parent if it would itself be eligible.

### 8.5.0

- **Added LinkedIn.** Hides Promoted posts and, optionally, Suggested/recommended content in the feed. Toggle with `Alt+Shift+L`, the 💼 button, or the panel. LinkedIn has moved to fully hashed class names — `feed-shared-update-v2`, `data-urn` and the other long-standing selectors all match nothing now — so this module uses no selectors at all. It reads rendered text and hides the tightest post-sized element containing a Promoted label, the same approach that makes the rotation fallback honeypot-immune. Verified on a live feed: 5 promoted posts hidden with 69 genuine posts untouched. The two promoted units that survived 8.5.0 were traced to scroll detection, fixed in 8.5.2: LinkedIn scrolls an inner container so the window scroll listener never fired. The 8.5.1 eligibility fix was a separate real bug found along the way.

### 8.4.0

- **Added a markup-rotation safety net.** When the health check reports that sponsored labels are visible — meaning the normal selectors have stopped matching — a fallback engages that ignores markup entirely. It reads only *rendered* text (position-aware, filtered by computed style and geometry) and hides the tightest bounded element containing a sponsored label. This matters because Facebook is documented to plant **hidden "Sponsored" honeypots inside ordinary posts** specifically to make naive text-matching blockers hide real content; reading rendered text rather than the DOM is immune to that by construction. It is a safety net, not a replacement: tested with every known selector renamed, it recovered 4 of 10 ad elements with **zero** of 20 real videos affected, in 20ms. Partial recovery with no collateral damage is the intended behaviour — it only runs when detection is already failing, so normal operation is unchanged.

### 8.3.0

- **Added `Seek past ads`, and a note on why you might turn it off.** When an ad has no working skip button the script seeks the player to the end. That is the most effective way to clear an unskippable ad, but it is also the exact signature YouTube's detection is described as looking for — an ad slot that loaded but never played, with an impossible timing profile. If you get repeated "Something went wrong" playback errors on videos with unskippable ads, switch **Seek past ads** off: skipping, muting and all feed/banner hiding keep working, and unskippable ads simply play muted instead of being jumped. On by default, because skipping ads is the point.

### 8.2.4

- **Fixed: `hideAutoplay` stopped working after the first video.** Disabling YouTube's autoplay toggle was wired to page load only, but YouTube navigates client-side, so it never ran again once you moved to another video. Every other per-navigation concern in the module was already hooked to navigation; this one was the exception. Now re-applied on each navigation.

### 8.2.3

- **Added tile-grid ad detection, covering desktop Marketplace and other card-based surfaces.** The existing detector reads each feed row's top header band, which works for posts but finds nothing on Marketplace, where ads are tiles inside horizontal rows with the label at the bottom. A second pass now scans bounded cards by text content and hides the *tightest* element containing a marker, so a row is never hidden when only one of its tiles is an ad. Verified on desktop Marketplace: 19 ads hidden, no sponsored label left visible, and all 48 real listings untouched. It is a clean no-op on the main feed, where labels are obfuscated and posts exceed the card size cap, so the two models do not overlap.

### 8.2.2

- **Fixed: sponsored Reels were never skipped on mobile.** `handleReels()` sat inside the `hasDesktopShell()` branch of the sweep, and mobile Facebook has no `[role="main"]`, so it never ran. The reel machinery itself worked fine on mobile — video, container and skip target all resolve — it was simply gated out. Reels handling is now ungated (it already self-guards on the URL path).
- **Fixed: `hideComments` did not match on mobile.** Mobile labels comment controls `Comment on reel by X, N comments`, which none of the previous four selectors matched. Broadened to `[aria-label^="Comment"]`, which covers every variant in one rule. `hideLikeCounts` also picks up `reacted`.

### 8.2.1

- **Fixed: no filtering at all on mobile Facebook.** `forceMostRecent` redirected to `/?sk=h_chr` and returned early, but mobile Facebook silently strips that parameter and serves `/` again — so the redirect fired on every load and the module never got past it. Filtering never initialised, and every sponsored post stayed visible. The redirect is now attempted at most once per tab, after which setup proceeds normally. Desktop still lands on the chronological feed.

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
