# userscripts

A small collection of browser userscripts for a cleaner, ad-free, more focused web — built and tuned against the live 2026 Facebook / YouTube DOM.

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click an **Install** link below — the manager will prompt to install.
3. Updates are automatic: each script has an `@updateURL`, so your manager pulls new versions from this repo. No re-pasting.

| Script | What it does | Install |
|---|---|---|
| **Facebook — Clean Feed** | Strips desktop Facebook to just your real newsfeed: hides ads/Sponsored (beats the character-scramble obfuscation), Stories, Reels trays, Suggested, People-you-may-know, and both sidebars; auto-skips Sponsored reels; strips UTM/tracking + unwraps `l.php` redirects; zooms the feed; forces the chronological "Most Recent" feed. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-clean-feed.user.js) |
| **Facebook Mobile — Clean Feed** | `m.facebook.com`: hides Sponsored / Suggested / People-you-may-know / Reels posts, leaves navigation intact. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-mobile-clean-feed.user.js) |
| **YouTube — Skip & Hide Ads** | Desktop + `m.youtube.com`: auto-skips video ads (clicks Skip, seeks past unskippable, mutes), skips Sponsored Shorts, hides feed/banner/overlay ads, dismisses the "ad blockers not allowed" popup. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/youtube-skip-ads.user.js) |
| **Site Blocker** | Block adult sites (always) and a "Focus Pack" of distractions (social, video, news, shopping) on a work-hours schedule. Add/remove sites and snooze from the menu. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/site-blocker.user.js) |
| **View Mode Switcher** | Toggle any site between Desktop and Mobile view (forces the viewport) via a draggable button, keyboard, or menu. Remembers per site. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/view-mode-switcher.user.js) |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+F` | Facebook clean feed — toggle on/off |
| `Alt+Shift+Y` | YouTube ad-skipping — toggle on/off |
| `Alt+Shift+B` | Site Blocker — toggle all blocking (works on the block screen too) |
| `Alt+Shift+V` | View Mode — switch Desktop ⇄ Mobile |

Shortcuts ignore typing in text fields and never use Cmd/Ctrl. Each is editable in the script's `CONFIG`.

## Notes

- **Config:** every script has a `CONFIG` block at the top — flip features, edit lists, change shortcuts/schedule.
- **Site Blocker** needs Tampermonkey or Violentmonkey (it uses the GM menu). For comprehensive adult blocking across *all* browsers and apps, pair it with a **DNS family filter** (Cloudflare `1.1.1.3` or NextDNS) — a userscript can't enumerate the whole category.
- **YouTube:** the userscript skips/hides ads after they're requested. For network-level blocking pair it with **uBlock Origin**.
- **Mobile-web caveat:** the mobile scripts were built from the documented mobile DOM but not device-tested; tune the selectors if something slips through. The View Switcher's effect shows on mobile browsers (desktop browsers ignore the viewport meta).
