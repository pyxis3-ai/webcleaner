import { expect, test } from "bun:test";
import { open } from "./harness.js";

const blocked = (p) => p.evaluate(() => (document.body?.id === "wc-blk" ? document.body.textContent : null));

test("custom list blocks the host and its subdomains; allow list wins", async () => {
  const p = await open({ url: "https://news.blocked.example/x", store: { wc7_siteBlocker: { custom: ["blocked.example"] } } });
  expect(await blocked(p)).toContain("news.blocked.example — on your block list.");
  await p.done();
  const q = await open({ url: "https://blocked.example/", store: { wc7_siteBlocker: { custom: ["blocked.example"], allow: ["blocked.example"] } } });
  expect(await blocked(q)).toBeNull();
  await q.done();
});

test("adult filter is on by default and switchable", async () => {
  const p = await open({ url: "https://www.pornhub.com/" });
  expect(await blocked(p)).toContain("blocked by adult filter");
  await p.done();
  const q = await open({ url: "https://www.pornhub.com/", store: { wc7_siteBlocker: { blockAdult: false } } });
  expect(await blocked(q)).toBeNull();
  await q.done();
});

test("focus pack is opt-in: switch or schedule window", async () => {
  const p = await open({ url: "https://www.reddit.com/" });
  expect(await blocked(p)).toBeNull();
  await p.done();
  const q = await open({ url: "https://www.reddit.com/", store: { wc7_siteBlocker: { blockFocus: true } } });
  expect(await blocked(q)).toContain("blocked by focus filter");
  await q.done();
  const r = await open({ url: "https://www.reddit.com/", store: { wc7_siteBlocker: { scheduleOn: true, schedule: { days: [0, 1, 2, 3, 4, 5, 6], from: "00:00", to: "23:59" } } } });
  expect(await blocked(r)).toContain("blocked during focus hours");
  await r.done();
});

test("snooze and the master switch lift blocking; site modules do not run on a block page", async () => {
  const p = await open({ url: "https://www.youtube.com/", store: { wc7_siteBlocker: { blockFocus: true, snoozeMinutes: 5 }, wc7_snz: Date.now() + 60000 } });
  expect(await blocked(p)).toBeNull();
  await p.done();
  const q = await open({ url: "https://www.youtube.com/", store: { wc7_siteBlocker: { blockFocus: true } } });
  expect(await blocked(q)).toContain("blocked by focus filter");
  expect(await q.has("#yt-css")).toBe(false);
  await q.keyboard.press("Alt+Shift+B");
  await q.waitForFunction(() => document.body?.id !== "wc-blk");
  expect((await q.get("wc7_siteBlocker")).enabled).toBe(false);
  await q.done();
});

test("menu commands block and allow the current site", async () => {
  const p = await open({ url: "https://generic.example/" });
  expect(await blocked(p)).toBeNull();
  await p.menu("➕ Block generic.example");
  await p.waitForFunction(() => document.body?.id === "wc-blk");
  expect((await p.get("wc7_siteBlocker")).custom).toEqual(["generic.example"]);
  await p.menu("➖ Allow generic.example");
  await p.waitForFunction(() => document.body?.id !== "wc-blk");
  expect(await p.get("wc7_siteBlocker")).toMatchObject({ custom: [], allow: ["generic.example"] });
  await p.done();
});
