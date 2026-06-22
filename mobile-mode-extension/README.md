# Mobile Mode (browser extension)

Get mobile sites - and true mobile **reflow** - on your desktop browser. This is the companion the userscripts in this repo provably **cannot** be (a userscript can't change a navigation's User-Agent or the viewport; an extension can).

Click the toolbar icon for a small popup with two tools:

## 1. Device mode (true reflow) - reflows ANY site

Picks a phone (Pixel 8 / iPhone / iPad mini / Responsive 390px) and emulates it on the active tab using the Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` + `setUserAgentOverride` + `setTouchEmulationEnabled`) via the `debugger` API. This is exactly what DevTools "device mode" / responsive design mode does - it changes the **real viewport**, so even normal CSS-`@media` sites reflow to their mobile layout, and the mobile User-Agent makes UA-sniffing sites serve mobile too.

Trade-off: while it's active, Chrome shows a yellow **"Mobile Mode started debugging this browser"** banner. Every debugger-based emulator (and DevTools itself) shows it; it's unavoidable. Click **Off / reset this tab** to stop.

## 2. Mobile UA only (no banner) - for UA-sniffing sites

A global toggle that rewrites the `User-Agent` + `Sec-CH-UA-Mobile` headers to a phone via `declarativeNetRequest`. Facebook, YouTube, and other sites that pick layout by User-Agent then serve their mobile site - no banner. It does **not** reflow pure-CSS-responsive sites (the viewport stays desktop-width); use Device mode for those.

## Why a userscript can't do either

`m.facebook.com` on desktop returns a **301 to www before any page JavaScript runs**, decided from the request's `User-Agent` / `Sec-CH-UA-Mobile` headers:

```
GET https://m.facebook.com/   ->  301   location: https://www.facebook.com/?_rdr
```

A userscript runs inside a loaded page; it can't set those request headers and never even executes on the mobile host. And CSS `@media` is evaluated against the real window width, which a userscript can't change (CSS zoom, viewport meta, `matchMedia` spoofing, and iframes were all tested and ruled out - the big sites also block framing). Only the browser can change the User-Agent and the viewport - which is what this extension does.

## What works where

| | Chrome / Edge / Brave | Firefox |
|---|---|---|
| Mobile UA only (no banner) | yes | yes |
| Device mode (true reflow) | yes (debugger API) | **no API** - use Firefox's built-in **Ctrl+Shift+M** (Responsive Design Mode), which does the same thing natively (reflow + device UA) |

Firefox simply doesn't expose a viewport-emulation API to extensions, so the popup hides the device buttons there and points you at the built-in tool. The extension still loads and the UA toggle works.

## Install (load unpacked)

**Chrome / Edge / Brave:**
1. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**.
2. **Load unpacked** -> select this `mobile-mode-extension/` folder. (If you already loaded an older version, click its **reload** to accept the new `debugger` permission.)
3. Pin it, click the icon, pick a device (or Mobile UA only).

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on...** -> select this folder's `manifest.json`. (Temporary add-ons clear on restart; that's a Firefox dev limitation unless you sign/package it.)
3. Click the icon -> **Mobile UA only**. For true reflow, use **Ctrl+Shift+M**.

## Notes / limits

- **Device mode is per-tab** (Chrome); Mobile UA only is global. Use **Off / reset** to clear.
- If a device button errors, **close DevTools on that tab** first - only one debugger can attach per tab.
- Manifest V3 background workers can sleep when idle; if emulation drops on a long-idle tab, click the device again.
- Pairs with the userscripts: in Mobile mode, mobile Facebook is cleaned by **facebook-mobile-clean-feed**, YouTube ads by **youtube-skip-ads**.
