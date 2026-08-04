# Web Cleaner

A browser userscript for a cleaner, ad-free, more focused web — built and verified against the live 2026 Facebook and YouTube DOM.

**Current version: 8.7.1** · [Changelog](#changelog) · [Limits](#limits--what-it-cannot-do)

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
| **View Mode Switcher** | Force Desktop or Mobile rendering per site. On a phone, Desktop reflows the real page via the viewport meta. On a desktop browser, Mobile rewrites the site's own `@media` breakpoints to a phone width and clamps the page into a centred phone frame, so pages genuinely reflow instead of only reporting a spoofed User-Agent. |

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
| Stories viewer | ❌ | ❌ | Not covered. The Stories *tray* on the feed is hidden by `Reels/Stories`. The viewer is a full-screen media player, not a post list or card grid, so neither detection model applies — and it has not been possible to observe a sponsored story to build against |
| Search, Videos, Events, Gaming, Profile | ✅ | ✅ | Covered by tile-grid detection wherever ads render as labelled cards |

## Limits — what it cannot do

- **Server-side ad stitching.** YouTube bakes some ads into the video stream itself. No client-side script can remove those.
- **In-video sponsor segments.** Creator read-outs ("this video is sponsored by…") are not ads in the DOM sense; use SponsorBlock for those.
- **User-Agent headers.** No userscript can change a navigation's request headers. Sites that pick their interface server-side from the UA (and redirect before any page JS runs) still serve their desktop interface. `Reflow CSS` then restyles what was served, which is what makes Mobile mode work on desktop; it cannot fetch a different page.
- **Cross-origin stylesheets that block CSSOM reads.** `Reflow CSS` rewrites `@media` rules in place, which needs `cssRules` access. Nearly all sites allow it (measured: Wikipedia 17/17 sheets readable, BBC 6/6, YouTube 15/18 — the 3 blocked are Google Fonts with no layout rules). LinkedIn is the known exception: its main sheet is CORS-blocked, so Mobile mode on desktop reflows little there.
- **Per-site overflow at phone width.** The frame clamps the page and contains `position:fixed` overlays, but a site's own component can still overflow its container if that component has no mobile styling of its own (BBC's cookie banner buttons, for example). Cosmetic, and confined to the element.
- **Strict Trusted Types sites.** If a site's CSP blocks the script's Trusted Types policy, the settings panel cannot be rendered at all (no string-to-DOM path exists under enforcement). The script detects this, shows a small notice pointing at the manager menu and hotkeys, and makes sure the panel host never blocks clicks. Everything else keeps working.
- **Substring matching.** Facebook splits the "Sponsored" label across text nodes, so detection must use substring matching — which means text containing "sponsored" as a substring (e.g. "unsponsored") can be hidden. Exact matching was tested and caught 0 of 2 real ads, so this trade is deliberate.
- **Schedule day-spill.** A schedule of `Mon` `22:00–06:00` does not block Tuesday 02:00.
- **Markup rotation.** Meta and Google change markup without notice. Three things happen: the panel warns you, the module button gets an amber ring, and a rendered-text fallback engages that recovers some ads without depending on markup. Recovery is partial by design — the fallback is bounded and hides only the tightest element containing a visible sponsored label, so it never risks the page. Full coverage returns when selectors are updated.

## Changelog

### 8.9.1

- **Verified the Facebook mobile path on a live logged-in phone-emulated feed.** A logged-in phone gets responsive `www.facebook.com`, and there is **no `[role="main"]`** there — so `hasDesktopShell()` is false and `processDesktop`, `processCards` and `hideLeftNav` never run on mobile. Everything rests on `processMobile`, which still resolves posts through `[data-tracking-duration-id]`. Measured across 46 real posts: 17 hidden by the phrase matcher and 7 more by the new `Follow suggestions` detection, 24 in total. Two structural consequences worth recording: `feedBox` cannot run on mobile because it requires `[role="main"]`, so `Widen feed` is desktop-only; and `processCards`' width limit computes to 226px at a 412px viewport while mobile posts are ~412px wide, so it would match nothing there even if it did run.

- **Fixed: Shorts skipped genuine videos at random.** `AD_S` included `ad-created`, but that class means "an ad player was constructed", not "an ad is playing" — it stays on the player afterwards. Paired with a preloaded, hidden ad slot satisfying the ad-UI half of the test, the gate fired on ordinary content. Caught live while walking a real Shorts feed: two advances triggered on Shorts reporting `getPresentingPlayerType() === 1`, carrying only `ad-created`. Re-run as an A/B over the same feed, the old gate produced 2 false advances and the corrected gate 0. `ad-created` is gone; `ad-showing` and `ad-interrupting` remain, and the authoritative player API is unaffected.
- **Verified a live desktop ad break.** Two ads, both caught during the window before YouTube renders its ad UI — the old gate evaluated false there while the fixed one was true from the first frame, and muting engaged where it previously could not. Once the break ended the gate went false and the 282s video played unmuted and unseeked, so the 180s seek guard held.
- **Verified mobile Shorts structurally.** `#shorts-player` does not exist on mobile — the player is `#movie_player`, so the existing fallback is load-bearing — and no false skip occurred on a normal Short after the fix.

### 8.9.0

- **New: `Follow suggestions`.** Verified against a live logged-in feed, Facebook no longer labels its recommended posts "Suggested for you" — across a full scroll of that feed the phrase appeared **zero** times. What it does instead is put a bare **Follow** button after the author, giving headers like `Proton · Follow · 7h` and `Turn key narrowboats · Follow · 7h`. No phrase list could catch that, and substring-matching "follow" would be reckless because it also matches *followers*, *following* and any post that merely says "follow me". Detection is therefore element-level: an innermost clickable element inside the post's 130px header band whose visible text is exactly "Follow". Measured live: 8 distinct posts flagged against 57 distinct posts kept, with **no false positives** — the composer, friends' posts, group posts and sponsored posts were all left alone, and no post whose header merely contained the word "follow" was flagged. On by default, switchable in the panel, and localized for the common variants.
- **On the 8.8.1 matcher change, measured properly.** An earlier note here claimed the old mobile matcher caught "0 of 76" posts. That figure came from feeding *desktop* concatenated headers into both matchers and does not describe the mobile path, which is corrected now. `processDesktop` reads one concatenated header band, so with labels trailing the page name — `Haven House Children's Hospice · Sponsored`, `The Queens · Sponsored` — `startsWith` genuinely could never fire there, and `includes` is required. `processMobile` instead tests individual elements under 40 characters, where a span reading exactly "Sponsored" already matched. Re-measured on a live logged-in mobile feed: across 46 posts the old and new matchers both hid 17. The change is still correct — it aligns the two paths and catches elements combining author and label — but it is a robustness fix on mobile, not a repair of a total failure.
- **Confirmed the LinkedIn limitation.** On a live logged-in feed, 1 of 5 stylesheets is CORS-blocked and the readable ones carry **zero** width-based media queries, so `Reflow CSS` genuinely has almost nothing to rewrite there. Promoted/Suggested detection itself works: 8 of 23 scanned posts matched.

### 8.8.2

- **Fixed: ad skipping never ran on mobile.** Mobile YouTube loads a different player binary — `player-plasma-es6` rather than desktop's `player_ias` — and the markers the skip gate depended on do not exist in it. Reverse-engineered from the shipped player source: `ad-showing` and `ad-interrupting` appear 8 and 4 times in the desktop player and **zero** times in the mobile one, and of the eight `.ytp-ad-*` overlay classes in the ad-UI probe, all eight are absent on mobile. The gate was `(adClass || adApi) && adUiPresent`, so on mobile it could only ever fire once a skip button had already rendered — meaning the unskippable opening seconds were never detected, `Mute ads` never engaged, and unskippable ads were never seeked past at all. Detection now trusts `getPresentingPlayerType()` on its own, which is present 47 times in the mobile player and returns 1 for ordinary playback on both platforms; the older class path keeps its UI confirmation. The same one-sided gate is fixed for Shorts.
- **Guarded `Seek past ads` against real videos.** Now that an API reading alone can trigger a skip, the seek additionally requires a duration of 180s or less, so a misread can never fast-forward a genuine video. Verified on live playback: `getPresentingPlayerType()` reports 1, the video is left unmuted and unseeked on both desktop and mobile.
- **Throttled the skip tap.** `tap()` fired on every DOM mutation during an ad — 126 synthetic tap sequences in 2.6 seconds on desktop. Now capped at one per 400ms, which cut it to 10 while still skipping and muting.
- **Mobile ad-UI selectors added** for the two that do exist in the mobile player, `ytp-ad-progress` and `ytp-ad-skip-button-container`.

Validated on live pages: normal playback untouched and a simulated ad muted and skipped, on desktop and mobile, over repeated runs. Mobile Shorts could not be confirmed end to end — signed-out Shorts redirects to a consent page — so that path is fixed structurally from the player source but is unverified against a live Short.

### 8.8.1

- **Fixed: mobile YouTube loaded forever on search and feed pages.** `Related` (on by default) injected `ytm-single-column-watch-next-results-renderer` and `ytm-item-section-renderer:has(ytm-video-with-context-renderer)` as global CSS. On desktop the equivalent selectors exist only on the watch page, so it was self-scoping; on mobile `ytm-item-section-renderer` is the generic feed section, so it also hid search results, and any feed built from it. Measured on a live mobile search: one matched element wrapped all 18 results (3.5M px², 3099 of the page's 5267 text characters). Because that container was `display:none` the document never grew past 915px, so YouTube's infinite scroll kept requesting continuations to fill a viewport that could never fill — 117 result nodes loaded instead of 19, every one of them invisible. That runaway is what "keeps loading" was. The mobile watch-next rules are now scoped to `html[data-yt-watch]`, set from `location.pathname` and refreshed on SPA navigation. Verified: search shows 19 of 19 results with no continuation loop, watch-page related videos still hidden, and the marker toggles correctly across pushState navigation both ways.
- **Fixed: Facebook suggested posts leaked on mobile but not desktop.** The mobile pass matched with `t===m || t.startsWith(m)` while the desktop pass used `includes`, so any label that did not begin with the marker was hidden on desktop and shown on mobile — and Facebook usually puts the author name first, as in "Julia Smith · Suggested for you". Mobile now uses `includes` like desktop, still bounded by the existing 40-character node cap that keeps it off post body text. Desktop and mobile now agree on every label tested.
- **Added the follow-suggestion phrases.** `Suggested accounts`, `People to follow`, `Accounts to follow` and `Pages to follow` were in no list, so they were shown on desktop as well. Checked against false positives: "Great suggestion from a friend", "I followed the recipe" and a bare "Follow" are all left alone.

### 8.8.0

- **Mobile view on desktop now actually reflows the page.** Previously it changed only what page JavaScript reads, so on a desktop browser it was close to a no-op on every site: measured on a live 1512px window, `matchMedia("(max-width:600px)")` returned `true` while the CSS `@media` behind it stayed `false` and the layout never moved. The three levers it pulled cannot work there — desktop browsers ignore `<meta viewport>` entirely, a userscript cannot change a navigation's UA header (every document request went out with the real desktop UA), and patching `window.matchMedia` does not affect CSS, which the layout engine evaluates itself. New `Reflow CSS` rewrites the site's own `@media` breakpoints in the CSSOM against the virtual phone width, covering `document`, `adoptedStyleSheets`, shadow roots, `@import`, and `media=""` attributes. Verified live: BBC 463 media rules rewritten and it renders its real mobile masthead and nav, Wikipedia 37, Hacker News 12, 0 blocked.
- **Fixed: `initVM` died silently at document-start.** When `documentElement` was not yet present, `applyVP()` threw on `appendChild` of the viewport meta and the top-level `run()` swallowed it. Everything after that line was lost — the MutationObserver, all four retry timers, the frame, and the `Alt+Shift+V` hotkey registration — and `vpLocked` was left stuck `true`, permanently blocking the retries meant to cover exactly this case. Hotkey registration now happens first, the DOM writes are guarded, and the retry schedule re-arms if the document root appears late.
- **Fixed: the viewport re-entrancy guard never worked.** `vpLocked` was set and cleared synchronously, but MutationObserver callbacks arrive as microtasks after that, so the guard was always `false` when checked — measured 18 full `applyVP` passes on one Wikipedia load. `applyVP` is now idempotent (it returns early when the meta is already correct) and is skipped entirely on desktop, where viewport meta has no effect.
- **Fixed: `matchMedia` missed unspaced queries.** The width tests used `\s*` but the feature tests were `includes("pointer: coarse")` with a literal space, so `(pointer:coarse)` — the form minified CSS and JS emit — fell through to the native result and answered `false` in Mobile mode. Queries are now parsed, not substring-matched.
- **Fixed: compound queries silently dropped their other terms.** `(min-width:768px) and (orientation:landscape)` was answered from the width alone. The spoof now rewrites only the terms it owns and hands the rest to the native engine, so unknown features stay correct — which also means `matchMedia` returns a real `MediaQueryList`, so `addEventListener` change events work. This removes the previous "returns a stub" limitation.
- **Frame contains fixed overlays.** The phone frame moved to the root element with a transform, making it the containing block for `position:fixed` descendants, so banners and sticky bars stay inside the phone instead of spanning the full window. `frameOnDesktop` now defaults on.

### 8.7.1

- **Fixed rails reappearing, compressed, after the feed is widened.** Rails were identified by comparing their position against the feed's *current* rect — but widening the feed moves its edges, so on later passes the rails overlapped it and no longer qualified. They stayed visible and were then squeezed by the wider feed. The module was measuring against a value it had itself changed. Rails are now identified independently: a narrow `<aside>` that is neither inside the feed nor contains it, assigned left or right by which half of the viewport its midpoint falls in. Verified on a live feed across five consecutive passes with the feed widened to 900px throughout: both rails (216px and 312px) tagged on the first pass and still tagged on the fifth, none visible in any round, none left compressed.

### 8.7.0

- **Fixed the "works sometimes" behaviour on LinkedIn.** LinkedIn virtualises its feed, recycling DOM nodes for different posts as you scroll. The module marked each element it had examined with a permanent flag, so once a node had been checked it was skipped forever — and when LinkedIn reused that node for a *different* post containing an ad, the ad was never examined. That is why filtering appeared to work on some posts and not others, and why results differed between sessions. Elements are now re-examined whenever their content changes, and an element that was hidden but no longer matches is released. Facebook already worked this way; LinkedIn did not.

### 8.6.7

- **Fixed the actual cause of "only the feed is missing" on LinkedIn.** The promoted-post sweep could hide the feed column itself. The column contains promoted posts, so it matches the markers, and whenever no child qualified as a tighter match the whole feed was tagged and hidden — leaving every surrounding element in place. The feed container and any ancestor of it are now excluded from the sweep outright. Verified live: feed visible at 900×1280 with its content, never tagged, both rails hidden, promoted posts hidden, none left in view.

### 8.6.6

- **LinkedIn feed detection rewritten against the live DOM, and tested there.** 8.6.3 through 8.6.5 each guessed at how to identify the feed column and each was wrong: by width (matched a page wrapper and squeezed the feed), then by counting post-shaped children (matched an empty skeleton placeholder with three children and zero text, while the real feed has only one such child). Measuring the live page showed the reliable signal is simply text: the feed is the **narrowest column at least 380px wide that contains real text**. Verified live end to end — the 552px feed is selected over both the 1128px wrapper and the empty skeleton, both rails are hidden, the feed stays visible with all its content, and widens 550 → 900px.

### 8.6.4

- **Fixed a regression in 8.6.3 that could hide or squeeze the LinkedIn feed itself.** Widening the search range to support wider layouts made it possible to select a page wrapper instead of the feed column, and the widening CSS then applied to the wrong element. The feed is now identified by structure rather than size — a column is only accepted if at least two of its direct children are post-shaped (tall, and nearly as wide as the column). If no such column is found, nothing is tagged and the module leaves the layout completely alone, which is the correct failure mode. Verified against wrapper, 552px column, 900px column and side-rail shapes.

### 8.6.3

- **Fixed: nothing hidden on wider LinkedIn layouts.** The feed column was located by a hard-coded 480–700px range, taken from the 552px column measured on one window size. On a wider window — or any layout where LinkedIn gives the feed more room — no column matched, so nothing was tagged and the rails, top bar and widening all silently did nothing. Detection is now relative to viewport width (380px up to 80% of the window, capped at 1400px) and picks the widest matching column. Verified across six layouts from 1024px to 2560px: the old range missed three of them, the new one finds all six.

### 8.6.2

- **Fixed: turning off `Promoted` and `Suggested` also disabled rail hiding and feed widening.** Those are independent features, but an early return sat between the stylesheet being installed and the sweep being wired — and the sweep is what tags the rails and feed column. So with both post filters off, the chrome settings silently did nothing. The chrome tagging now runs regardless; only the promoted-post scan is gated on having markers.

### 8.6.1

- **LinkedIn mobile verified.** Previously listed as untested. Confirmed on a live logged-in mobile session at 412×915: the feed column is 412px so it clears the module's 280px minimum, promoted posts are hidden as you scroll, none remain in view, and all 70 genuine posts are intact. Worth noting the scroll container differs by layout — `main#workspace` on desktop, the document itself on mobile — which the capture-phase listener added in 8.5.2 handles either way.

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
