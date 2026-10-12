import { expect, test } from "bun:test";
import { fixture, open } from "./harness.js";

const GEN = "https://generic.example/";
const sections = (panel) => panel.locator("details[data-s]").evaluateAll((els) => els.map((e) => e.getAttribute("data-s")));

test("opens from the menu with the sections for this site, closes on Escape", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  const panel = await p.panel();
  expect(await sections(panel)).toEqual(["sb", "focus", "adult", "sb-adv", "vm", "vm-adv", "io"]);
  expect(await panel.locator("h1").textContent()).toContain("Web Cleaner");
  await p.keyboard.press("Escape");
  expect(await p.has("#wc-panel")).toBe(false);
  await p.done();
  const q = await open({ url: "https://www.facebook.com/?sk=h_chr", html: fixture("fb-desktop.html") });
  expect(await sections(await q.panel())).toContain("facebook");
  await q.done();
});

test("switches, numbers and lists persist, with bounds and host validation at the boundary", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), store: { wc7_viewMode: { mobileWidth: 50, spoofUA: "yes", bogus: 1 } } });
  const panel = await p.panel();
  expect(await panel.locator('input[data-num="viewMode.mobileWidth"]').inputValue()).toBe("240");
  expect(await panel.locator('input[data-sw="viewMode.spoofUA"]').isChecked()).toBe(true);
  await panel.locator('label:has(input[data-sw="viewMode.showButton"])').click();
  expect(await p.get("wc7_viewMode")).toMatchObject({ showButton: false, mobileWidth: 240, spoofUA: true });
  expect((await p.get("wc7_viewMode")).bogus).toBeUndefined();
  await panel.locator('input[data-num="viewMode.mobileWidth"]').fill("9999");
  await panel.locator('input[data-num="viewMode.mobileWidth"]').press("Tab");
  expect((await p.get("wc7_viewMode")).mobileWidth).toBe(1080);
  await panel.locator('[data-ai="siteBlocker.custom"]').fill("HTTPS://WWW.Foo.Example/path?q");
  await panel.locator('[data-ab="siteBlocker.custom"]').click();
  expect((await p.get("wc7_siteBlocker")).custom).toEqual(["foo.example"]);
  await panel.locator('[data-ai="siteBlocker.custom"]').fill("not a host");
  await panel.locator('[data-ab="siteBlocker.custom"]').click();
  expect((await p.get("wc7_siteBlocker")).custom).toEqual(["foo.example"]);
  await panel.locator('[data-dl="siteBlocker.custom"]').click();
  expect((await p.get("wc7_siteBlocker")).custom).toEqual([]);
  expect(await p.has("#wc-panel")).toBe(true);
  await p.done();
});

test("hotkeys are rebound by capture", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  const panel = await p.panel();
  await panel.locator('[data-hk="siteBlocker"]').click();
  await p.keyboard.press("Alt+Shift+K");
  expect((await p.get("wc7_siteBlocker")).toggleHotkey).toEqual({ ctrl: false, alt: true, shift: true, key: "k" });
  await p.done();
});

test("import replaces settings and reset restores defaults", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  const panel = await p.panel();
  await panel.locator("[data-import]").fill(JSON.stringify({ viewMode: { longPressMs: 700 }, junk: 1 }));
  await panel.locator("[data-importbtn]").click();
  await p.waitForFunction(() => window.__gm.get("wc7_viewMode")?.longPressMs === 700);
  p.on("dialog", (d) => d.accept());
  await (await p.panel()).locator("[data-reset]").click();
  await p.waitForFunction(() => window.__gm.get("wc7_viewMode")?.longPressMs === 500);
  await p.done();
});

test("renders under an enforced Trusted Types policy", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), headers: { "content-security-policy": "require-trusted-types-for 'script'; trusted-types sitepolicy" } });
  const panel = await p.panel();
  expect(await panel.locator('.cd[role="dialog"] h1').textContent()).toContain("Web Cleaner");
  await p.done();
});

test("button cluster shows the panel button and remembers a dragged position", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  await p.waitForSelector("#wc-cl");
  const box = await p.locator("#wc-cl").boundingBox();
  await p.mouse.move(box.x + 16, box.y + 16);
  await p.mouse.down();
  await p.mouse.move(box.x - 200, box.y - 200, { steps: 60 });
  await p.mouse.up();
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("wc7_clpos")));
  expect(saved.l).toBeLessThan(box.x);
  expect(await p.has("#wc-panel")).toBe(false);
  await p.done();
});
