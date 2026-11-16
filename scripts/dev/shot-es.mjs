// Dev helper: screenshot with a locale cookie. node scripts/dev/shot-es.mjs <out.png> <locale> <route>
import { chromium } from "@playwright/test";
const [, , out, locale, route] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "arc_locale", value: locale, url: "http://localhost:3210" }]);
const page = await ctx.newPage();
await page.goto(`http://localhost:3210${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
await browser.close();
