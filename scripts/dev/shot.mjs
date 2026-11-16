// Dev helper: screenshot pages. node scripts/dev/shot.mjs <outDir> <width> <height> <full:0|1> <route> [route...]
import { chromium } from "@playwright/test";
const [, , outDir, w = "1440", h = "900", full = "1", ...routes] = process.argv;
const base = process.env.BASE_URL ?? "http://localhost:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
for (const route of routes) {
  const errors = [];
  page.removeAllListeners("console");
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
  await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const name = route.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "root";
  await page.screenshot({ path: `${outDir}/${name}-${w}.png`, fullPage: full === "1" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${route}: ${errors.length ? "ERRORS " + errors.join(" | ") : "ok"}${overflow ? " · HORIZONTAL OVERFLOW" : ""}`);
}
await browser.close();
