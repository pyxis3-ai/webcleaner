# Web Cleaner

A browser userscript for a cleaner, ad-free, more focused web - built and tuned against the live 2026 Facebook / YouTube DOM.

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click an **Install** link below - the manager will prompt to install.
3. Updates are automatic: your manager re-fetches each script from the URL it was installed from, so installing from the links below keeps you current. No re-pasting.

| Script | What it does | Install |
|---|---|---|
| **Web Cleaner** | One userscript, four modules: **Facebook Clean Feed** (strips ads/Sponsored, Stories, Reels trays, Suggested, People-you-may-know, both sidebars, composer and top bar; auto-skips Sponsored reels; strips UTM/tracking + unwraps `l.php`; widens the feed into the space freed by the hidden sidebars; forces the chronological "Most Recent" feed - desktop **and** mobile web), **YouTube Skip Ads** (auto-skips video ads, skips Sponsored Shorts, hides feed/banner/overlay ads, dismisses the anti-adblock popup - desktop, `m.youtube.com` and YouTube Music), **Site Blocker** (adult filter always + a work-hours "Focus Pack" of distractions, custom block/allow lists, snooze), and **View Mode Switcher** (force Desktop or Mobile rendering per site). Everything is configurable from one in-page panel - open **⚙ Web Cleaner settings…** from your userscript-manager menu. | [Install](https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js) |

## One script, four modules

Web Cleaner is a single userscript. Each module (Facebook, YouTube, Site Blocker, View Mode) runs inside its own error boundary, so one site's redesign breaking a module can't take down the others. Shared plumbing - the draggable button, storage, hotkey handling, and the settings panel - is written once.

### Migrating from the old four scripts

Install **Web Cleaner**, then remove the old **Facebook Clean Feed**, **YouTube Skip Ads**, **Site Blocker**, and **View Mode Switcher** scripts from your manager. Per-site view modes, snoozes, and button positions carry over; Site Blocker's custom block/allow lists and other saved settings reset to defaults, so re-add any custom sites once from the panel.

## Controls - the same layers everywhere

| Layer | Where |
|---|---|
| **⚙ Web Cleaner settings…** panel (from the manager menu) | every feature toggle, site list, schedule, hotkey, and tuning value - persisted to your manager's storage, no file editing |
| Toggle hotkey | each module (table below); rebindable in the panel |
| Draggable on-page button (remembers its spot) | Facebook 🧹, YouTube ⏭, View Switcher 🖥/📱 |
| Userscript-manager menu | ⚙ settings panel + quick actions: toggle Facebook / YouTube / blocking, block or allow this site, switch View mode |

Site Blocker deliberately has no floating button - it matches every page on the web, so its controls live in the manager menu, the hotkey, the settings panel, and the block screen itself.

| Shortcut | Action |
|---|---|
| `Alt+Shift+F` | Facebook clean feed - toggle (desktop + mobile site) |
| `Alt+Shift+Y` | YouTube ad-skipping - toggle |
| `Alt+Shift+B` | Site Blocker - toggle all blocking (works on the block screen too) |
| `Alt+Shift+V` | View Mode - switch Desktop ⇄ Mobile |

Shortcuts ignore typing in text fields and never use Cmd/Ctrl. Each is rebindable in the settings panel (each module's **Advanced** section).

## Notes

- **Settings & auto-updates:** every setting lives in the panel and is saved to your userscript manager's storage - you never edit the script file, so auto-updates keep working and your settings persist across updates.
- **Site Blocker** needs Tampermonkey or Violentmonkey (GM storage + menu). The "Allow for 5 minutes" snooze applies to every filter, adult included. For comprehensive adult blocking across all browsers and apps, pair it with a DNS family filter (Cloudflare `1.1.1.3` or NextDNS) - a userscript can't enumerate the whole category.
- **YouTube:** ads are skipped/hidden after they're requested. For network-level blocking pair it with uBlock Origin. YouTube is rolling out server-side ad stitching (ads baked into the video stream itself); no client-side blocker or script can remove those - the script still auto-skips and mutes everything skippable.
- **Facebook mobile branch:** device-tested against a logged-in phone session. Note that a logged-in phone is served the responsive `www.facebook.com`, *not* `m.facebook.com`, so the module picks its code path by inspecting the markup rather than the hostname. Add markers under **Extra junk phrases** in the panel's Facebook section if something slips through.
- **Widen feed:** hiding both sidebars reclaims roughly half the window on a desktop feed, so the feed column is widened to fill it (default 1100px, tunable under Facebook → Advanced → **Feed max width**, or switch **Widen feed** off to keep Facebook's native 680px). Wider columns letterbox tall images, so lower the value if you post-scroll a lot of portrait media.
- **View Switcher reach:** on a phone, "Desktop" works via the viewport meta - the right lever there. On a desktop browser, "Mobile" spoofs only what page JavaScript reads (UA / touch / `matchMedia`): client-side responsive sites switch, but no userscript can change the request's User-Agent header or the real window width, so server-decided sites (Facebook, YouTube) and pure CSS `@media` sites won't switch - that's a hard limit no userscript can cross (only a browser or extension can change the request User-Agent and real window width). Because the spoof is injected into the page context, it now works even under Firefox's sandboxed managers. A centered phone-width frame is available via **Phone frame on desktop** in the panel.

## Contributing

Issues, ideas, and PRs are welcome - keep PRs focused on a single concern and follow the existing conventions.

## Support & sponsors

Web Cleaner is free and has no tracking or ads. If it's useful to you, you can support continued development - pay what you like, once or monthly:

<p align="center">
  <a href="https://donate.stripe.com/3cI6oI7Gh1PG0eV8MJ5kk00"><img src="https://img.shields.io/badge/%20Donate%20once-pay%20what%20you%20like-635bff?logo=stripe&logoColor=white" alt="Donate once via Stripe" height="30" /></a>
  &nbsp;
  <a href="https://buy.stripe.com/00wbJ2f8J51S9Pv1kh5kk01"><img src="https://img.shields.io/badge/%20Sponsor%20monthly-recurring-56c4e6?logo=stripe&logoColor=white" alt="Sponsor monthly via Stripe" height="30" /></a>
</p>
