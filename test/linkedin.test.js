import { expect, test } from "bun:test";
import { fixture, open } from "./harness.js";

const li = (extra = {}) => open({ url: "https://www.linkedin.com/feed/", html: fixture("li.html"), ...extra });

test("feed column found by child count, widened, rails hidden, promoted and suggested posts hidden", async () => {
  const p = await li();
  await p.tagged("#p3[data-li-h]");
  await p.waitForTimeout(1500);
  expect(await p.evaluate(() => document.getElementById("feed").getBoundingClientRect().width)).toBe(900);
  expect(await p.display("#left")).toBe("none");
  expect(await p.display("#right")).toBe("none");
  expect(await p.evaluate(() => [...document.querySelectorAll("[data-li-h]")].map((e) => e.id))).toEqual(["p3", "p6"]);
  expect(await p.display("#top")).toBe("block");
  expect(await p.display("#feed")).toBe("block");
  await p.done();
});

test("Top bar is geometric and off by default", async () => {
  const p = await li({ store: { wc7_linkedin: { hideTopBar: true } } });
  await p.tagged("#top[data-li-h]");
  expect(await p.display("#top")).toBe("none");
  await p.done();
});

test("Hide feed hides the column on /feed only and stops the post sweep", async () => {
  const p = await li({ store: { wc7_linkedin: { hideFeed: true } } });
  await p.tagged("#feed[data-li-gone]");
  await p.waitForTimeout(1500);
  expect(await p.display("#feed")).toBe("none");
  expect(await p.has("[data-li-h]")).toBe(false);
  expect(await p.display("#top")).toBe("block");
  await p.done();
  const q = await open({ url: "https://www.linkedin.com/in/someone/", html: fixture("li.html"), store: { wc7_linkedin: { hideFeed: true } } });
  await q.tagged("#p3[data-li-h]");
  expect(await q.has("#feed[data-li-gone]")).toBe(false);
  await q.done();
});

test("hotkey disables the module and restores what it hid", async () => {
  const p = await li();
  await p.tagged("#p3[data-li-h]");
  await p.keyboard.press("Alt+Shift+L");
  expect(await p.display("#p3")).toBe("block");
  expect(await p.display("#left")).toBe("block");
  expect((await p.get("wc7_linkedin")).enabled).toBe(false);
  await p.done();
});
