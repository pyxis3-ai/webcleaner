import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

export const SRC = readFileSync(new URL("../webcleaner.user.js", import.meta.url), "utf8");
export const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const browser = await chromium.launch();

const shim = (store, local, gm) => `(() => {
  const L = localStorage, P = "__gm_";
  if (!L.getItem(P + "seeded")) {
    L.setItem(P + "seeded", "1");
    for (const [k, v] of Object.entries(${JSON.stringify(store)})) L.setItem(P + k, JSON.stringify(v));
    for (const [k, v] of Object.entries(${JSON.stringify(local)})) L.setItem(k, v);
  }
  const menu = {};
  window.__gm = { menu, get: (k) => JSON.parse(L.getItem(P + k)) };
  if (${gm}) {
    window.GM_getValue = (k, d) => { const v = L.getItem(P + k); return v === null ? d : JSON.parse(v); };
    window.GM_setValue = (k, v) => L.setItem(P + k, JSON.stringify(v));
    window.GM_registerMenuCommand = (l, fn) => { menu[l] = fn; };
    window.GM_info = { script: { version: "test" } };
    window.unsafeWindow = window;
  }
})();
`;

export async function open({ url, html = "<!doctype html><title>t</title><body>page</body>", store = {}, local = {}, gm = true, headers = {}, viewport, ua, json = {}, raw = {} }) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 720 }, userAgent: ua, hasTouch: !!ua });
  await ctx.addInitScript({ content: shim(store, local, gm) + SRC });
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    for (const k of Object.keys(json)) if (u.includes(k)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json[k]) });
    for (const k of Object.keys(raw)) if (u.includes(k)) return route.fulfill({ status: 200, contentType: "text/plain", body: raw[k] });
    if (route.request().resourceType() === "document") return route.fulfill({ status: 200, contentType: "text/html", headers, body: html });
    return route.abort();
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body && document.getElementById("wc-cl"));
  page.errors = errors;
  page.done = async () => {
    await ctx.close();
    if (errors.length) throw new Error("page errors: " + errors.join(" | "));
  };
  page.get = (k) => page.evaluate((k) => window.__gm.get(k), k);
  page.menu = (label) => page.evaluate((l) => window.__gm.menu[l](), label);
  page.display = (sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? getComputedStyle(e).display : "missing";
    }, sel);
  page.has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  page.tagged = (sel, timeout) => page.waitForSelector(sel, { state: "attached", timeout });
  page.settled = async (ms = 1200) => {
    await page.waitForTimeout(ms);
    await page.waitForFunction(() => document.body && document.getElementById("wc-cl"));
  };
  page.panel = async () => {
    await page.menu("⚙ Web Cleaner");
    await page.waitForSelector("#wc-panel");
    const panel = page.locator("#wc-panel");
    await panel.locator("details").evaluateAll((els) => els.forEach((e) => (e.open = true)));
    return panel;
  };
  return page;
}
