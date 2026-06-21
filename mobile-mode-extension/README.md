# Mobile Mode (browser extension)

Force websites to serve their **mobile interface** on your desktop browser — the one thing the userscripts in this repo provably **cannot** do.

## Why a userscript can't do this (the part everyone gets wrong)

When you open `m.facebook.com` on a desktop browser, the server answers with a **301 redirect** straight back to `www.facebook.com` — *before any page JavaScript runs.* Traced to the wire:

```
GET https://m.facebook.com/        →  301   location: https://www.facebook.com/?_rdr
  request headers (set by the BROWSER, not the page):
    user-agent: …Macintosh… Chrome…   ← desktop
    sec-ch-ua-mobile: ?0              ← Client Hint: "not mobile"
```

A userscript runs *inside a page after it loads*. It can spoof `navigator.userAgent` for JavaScript, but it **cannot change the `User-Agent` / `Sec-CH-UA-Mobile` headers on a navigation request** — those are sent by the browser before the userscript exists. So it never even runs on `m.facebook.com`. (CSS `@media`, viewport meta, CSS zoom, and iframes were all tested and ruled out too; the big sites also block framing.)

**An extension can rewrite request headers via `declarativeNetRequest`.** Verified: with a mobile UA, `www.facebook.com` serves its mobile interface on a 1280px desktop window (mobile viewport meta, no desktop sidebars, mobile tab bar).

## What it does

A single toolbar toggle. When **on** (badge shows `M`), it rewrites the `User-Agent` + `Sec-CH-UA-Mobile` + `Sec-CH-UA-Platform` headers on every request to an Android Chrome phone, and reloads the tab. Sites that pick layout by User-Agent (Facebook, YouTube, and many others) then serve their mobile version. Toggle **off** to go back to normal.

This gives you the mobile **site/interface** on desktop (rendered at your window width). For an exact phone-sized **viewport** too, use the browser's built-in **DevTools device mode** (`Cmd+Shift+M` / `Ctrl+Shift+M`) — that's the only thing that truly resizes the viewport, and it's what device-emulator extensions use under the hood.

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `mobile-mode-extension/` folder.
4. Pin the extension; click its icon to toggle Mobile Mode (the `M` badge means it's on). Reload Facebook/YouTube to see the mobile site.

Works in Chrome/Edge/Brave (Manifest V3). Firefox needs minor manifest tweaks (different `background` key).

## Notes / limits

- It's a **global** toggle (all sites) — turn it off for normal desktop browsing.
- A few sites detect the UA/touch mismatch; if one misbehaves, toggle off.
- It pairs with the userscripts: in Mobile Mode, `m.facebook.com` / mobile Facebook is cleaned by **facebook-mobile-clean-feed**, YouTube ads by **youtube-skip-ads**.
