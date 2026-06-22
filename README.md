# userscripts

A small collection of browser userscripts for a cleaner, ad-free, more focused web - built and tuned against the live 2026 Facebook / YouTube DOM.

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click an **Install** link below - the manager will prompt to install.
3. Updates are automatic: each script has an `@updateURL`, so your manager pulls new versions from this repo. No re-pasting.

| Script | What it does | Install |
|---|---|---|
| **Facebook - Clean Feed** | Strips desktop Facebook to just your real newsfeed: hides ads/Sponsored (beats the character-scramble obfuscation), Stories, Reels trays, Suggested, People-you-may-know, and both sidebars; auto-skips Sponsored reels; strips UTM/tracking + unwraps `l.php` redirects; forces the chronological "Most Recent" feed. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-clean-feed.user.js) |
| **Facebook Mobile - Clean Feed** | `m.facebook.com`: hides Sponsored / Suggested / People-you-may-know / Reels posts, leaves navigation intact. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-mobile-clean-feed.user.js) |
| **YouTube - Skip & Hide Ads** | Desktop + `m.youtube.com`: auto-skips video ads (clicks Skip, seeks past unskippable, mutes), skips Sponsored Shorts, hides feed/banner/overlay ads, dismisses the "ad blockers not allowed" popup. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/youtube-skip-ads.user.js) |
| **Site Blocker** | Block adult sites (always) and a "Focus Pack" of distractions (social, video, news, shopping) on a work-hours schedule. Add/remove sites and snooze from the menu. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/site-blocker.user.js) |
| **View Mode Switcher** | Force any site into Desktop or Mobile rendering - overrides the device signals sites actually read (user-agent, touch, `matchMedia`), not just the viewport. On a phone, "Desktop" gives the real desktop layout; on a desktop browser, "Mobile" serves the full-width mobile site. Draggable button, keyboard, or menu; remembers per site. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/view-mode-switcher.user.js) |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+F` | Facebook clean feed - toggle on/off |
| `Alt+Shift+Y` | YouTube ad-skipping - toggle on/off |
| `Alt+Shift+B` | Site Blocker - toggle all blocking (works on the block screen too) |
| `Alt+Shift+V` | View Mode - switch Desktop ⇄ Mobile |

Shortcuts ignore typing in text fields and never use Cmd/Ctrl. Each is editable in the script's `CONFIG`.

## Notes

- **Config:** every script has a `CONFIG` block at the top - flip features, edit lists, change shortcuts/schedule.
- **Site Blocker** needs Tampermonkey or Violentmonkey (it uses the GM menu). For comprehensive adult blocking across *all* browsers and apps, pair it with a **DNS family filter** (Cloudflare `1.1.1.3` or NextDNS) - a userscript can't enumerate the whole category.
- **YouTube:** the userscript skips/hides ads after they're requested. For network-level blocking pair it with **uBlock Origin**.
- **Mobile-web caveat:** the mobile scripts were built from the documented mobile DOM but not device-tested; tune the selectors if something slips through.
- **View Switcher reach:** "Desktop view on a phone" reflows the real page - the viewport meta is the correct lever on a mobile browser. "Mobile view on a desktop browser" spoofs the device signals (UA / touch / `matchMedia`) and serves the full-width mobile site, so JS-driven responsive sites switch - but a desktop browser can't truly resize its own window, so sites that rely purely on CSS `@media (max-width)` won't reflow there. For those, use a mobile browser or your DevTools device-emulation mode. (A centered phone-width frame is available via `frameOnDesktop` in the script's `CONFIG`.)

## Mobile Mode (companion extension) - mobile sites on desktop

A userscript fundamentally **cannot** force a mobile layout on desktop: big sites (Facebook, YouTube) decide mobile-vs-desktop from the request's **User-Agent** at the server (301 before any page script runs), and normal sites decide it from CSS `@media` against the real window width - and a userscript can change neither (only the browser can). The small **[`mobile-mode-extension/`](mobile-mode-extension/)** (Manifest V3, load-unpacked) does both, via a toolbar popup:

- **Device mode** - true DevTools-style viewport emulation (`Emulation.setDeviceMetricsOverride` via the `debugger` API) that reflows **any** site, normal CSS-responsive ones included (pick Pixel / iPhone / iPad / Responsive). Shows Chrome's debugging banner while active.
- **Mobile UA only** - rewrites the `User-Agent` via `declarativeNetRequest` so UA-sniffing sites serve their mobile site; no banner.

See its [README](mobile-mode-extension/README.md).
