# userscripts

A small collection of browser userscripts for a cleaner, ad-free, more focused web - built and tuned against the live 2026 Facebook / YouTube DOM.

## Install

1. Install a userscript manager: **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome/Edge/Firefox; on Android use Firefox + one of these, on iOS use the Userscripts app for Safari).
2. Click an **Install** link below - the manager will prompt to install.
3. Updates are automatic: your manager re-fetches each script from the URL it was installed from, so installing from the links below keeps you current. No re-pasting.

| Script | What it does | Install |
|---|---|---|
| **Facebook Clean Feed** | One script for desktop **and** `m.facebook.com`: strips Facebook to just your real newsfeed - hides ads/Sponsored (beats the character-scramble obfuscation; detects the "Sponsored" label in 20+ languages incl. Arabic, CJK and Cyrillic), Stories, Reels trays, Suggested, People-you-may-know, both sidebars, the composer and the top bar; auto-skips Sponsored reels; strips UTM/tracking + unwraps `l.php` redirects; forces the chronological "Most Recent" feed. Junk-hiding also covers the **Groups** and **Watch** feeds and individual group pages. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-clean-feed.user.js) |
| **YouTube Skip Ads** | Desktop, `m.youtube.com` **and YouTube Music**: auto-skips video ads (clicks Skip, seeks past unskippable, mutes), skips Sponsored Shorts, hides feed/banner/overlay ads, dismisses the "ad blockers not allowed" popup. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/youtube-skip-ads.user.js) |
| **Site Blocker** | Block adult sites (always) and a "Focus Pack" of distractions (social, video, news, shopping) on a work-hours schedule. Add/remove sites and snooze from the menu. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/site-blocker.user.js) |
| **View Mode Switcher** | Force a site into Desktop or Mobile rendering by overriding the client-side device signals (user-agent, touch, `matchMedia`) and the viewport. On a phone, "Desktop" gives the real desktop layout. On a desktop browser, "Mobile" switches JS-driven responsive sites - sites decided server-side from the request User-Agent (Facebook, YouTube) need the Mobile Mode extension below. Remembers per site. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/view-mode-switcher.user.js) |

> Upgrading: **Facebook Mobile - Clean Feed** is gone - it was merged into **Facebook Clean Feed** v3, which now matches `m.facebook.com` too. Remove the old mobile script if you had it installed.

## Why these are separate scripts

- One script per concern: different sites, different DOMs, different mechanics. Separate scripts mean you install only what you use, and one site's redesign can't break the rest.
- **Facebook desktop + mobile** *were* two scripts (completely different DOMs); everything around the DOM work was duplicated, so they are now one script with a per-host branch.
- **Site Blocker** and **View Mode Switcher** both match every site but share nothing: one blocks pages, the other changes how pages render.
- **Mobile Mode** is a browser extension, not a userscript, because only an extension can change the request's User-Agent header and the real viewport - the two levers "mobile on desktop" actually needs.

## Controls - the same layers everywhere

| Layer | Where |
|---|---|
| `CONFIG` block at the top | every script - flip features, edit lists, change shortcuts/schedule |
| Toggle hotkey | every script (table below) |
| Draggable on-page button (remembers its spot) | Facebook 🧹 · YouTube ⏭ · View Switcher 🖥/📱 · Mobile Mode 📱 |
| Userscript-manager menu | Site Blocker and View Mode Switcher (the two that keep settings) |

Site Blocker deliberately has no floating button - it matches every page on the web, so its controls live in the manager menu, the hotkey, and the block screen itself.

| Shortcut | Action |
|---|---|
| `Alt+Shift+F` | Facebook clean feed - toggle (desktop + mobile site) |
| `Alt+Shift+Y` | YouTube ad-skipping - toggle |
| `Alt+Shift+B` | Site Blocker - toggle all blocking (works on the block screen too) |
| `Alt+Shift+V` | View Mode - switch Desktop ⇄ Mobile |

Shortcuts ignore typing in text fields and never use Cmd/Ctrl. Each is editable in the script's `CONFIG`.

## Notes

- **Editing `CONFIG` vs auto-updates:** if you edit an installed script, Tampermonkey pauses auto-updates for it and Violentmonkey overwrites your edits on the next update. For permanent custom config, keep your own copy of the raw file.
- **Site Blocker** needs Tampermonkey or Violentmonkey (GM storage + menu). The "Allow for 5 minutes" snooze applies to every filter, adult included. For comprehensive adult blocking across all browsers and apps, pair it with a DNS family filter (Cloudflare `1.1.1.3` or NextDNS) - a userscript can't enumerate the whole category.
- **YouTube:** ads are skipped/hidden after they're requested. For network-level blocking pair it with uBlock Origin. YouTube is rolling out server-side ad stitching (ads baked into the video stream itself); no client-side blocker or script can remove those - the script still auto-skips and mutes everything skippable.
- **Facebook mobile branch:** built from the documented `m.facebook.com` DOM, not device-tested - add markers to `extraJunkPhrases` in `CONFIG` if something slips through.
- **View Switcher reach:** on a phone, "Desktop" works via the viewport meta - the right lever there. On a desktop browser, "Mobile" spoofs only what page JavaScript reads (UA / touch / `matchMedia`): client-side responsive sites switch, but no userscript can change the request's User-Agent header or the real window width, so server-decided sites (Facebook, YouTube) and pure CSS `@media` sites won't - that's the extension's job. On Firefox, sandboxed managers can keep the JS spoof from reaching page scripts (the viewport lever still works). A centered phone-width frame is available via `frameOnDesktop` in `CONFIG`.

## Mobile Mode (companion extension) - mobile sites on desktop

A userscript fundamentally **cannot** force a mobile layout on desktop: big sites (Facebook, YouTube) decide mobile-vs-desktop from the request's **User-Agent** at the server (301 before any page script runs), and normal sites decide it from CSS `@media` against the real window width - and a userscript can change neither (only the browser can). The small **[`mobile-mode/`](mobile-mode/)** (Manifest V3, load-unpacked) adds an **inline, on-page floating button** (no popup) to toggle it:

- **Chrome / Edge** - true DevTools-style viewport reflow via the `debugger` API (`Emulation.setDeviceMetricsOverride`); reflows **any** site.
- **Firefox** - switches the `User-Agent` (`declarativeNetRequest`) so UA-sniffing sites serve their mobile site. Firefox has no extension viewport API, so for true reflow of any site use its built-in **Responsive Design Mode (`Ctrl+Shift+M`, macOS `Cmd+Opt+M`)**, itself an inline device bar.

See its [README](mobile-mode/README.md).

## Contributing

Issues, ideas, and PRs are welcome - keep PRs focused on a single concern and follow the existing conventions.

## Support & sponsors

These userscripts are free and have no tracking or ads. If they're useful to you, you can support continued development - pay what you like, once or monthly:

<p align="center">
  <a href="https://donate.stripe.com/3cI6oI7Gh1PG0eV8MJ5kk00"><img src="https://img.shields.io/badge/%20Donate%20once-pay%20what%20you%20like-635bff?logo=stripe&logoColor=white" alt="Donate once via Stripe" height="30" /></a>
  &nbsp;
  <a href="https://buy.stripe.com/00wbJ2f8J51S9Pv1kh5kk01"><img src="https://img.shields.io/badge/%20Sponsor%20monthly-recurring-56c4e6?logo=stripe&logoColor=white" alt="Sponsor monthly via Stripe" height="30" /></a>
</p>
