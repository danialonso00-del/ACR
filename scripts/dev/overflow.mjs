// Dev helper: list elements wider than the viewport. node scripts/dev/overflow.mjs <route> [width]
import { chromium } from "@playwright/test";
const [, , route = "/", w = "390"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } });
await page.goto(`http://localhost:3210${route}`, { waitUntil: "networkidle" });
const res = await page.evaluate(() => {
  const vw = window.innerWidth;
  return [...document.querySelectorAll("body *")]
    .filter((el) => el.getBoundingClientRect().right > vw + 1)
    .filter((el) => !(el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1))
    .slice(0, 10)
    .map((el) => `${el.tagName}.${String(el.className).slice(0, 90)} right=${Math.round(el.getBoundingClientRect().right)}`);
});
console.log(res.join("\n"));
await browser.close();
