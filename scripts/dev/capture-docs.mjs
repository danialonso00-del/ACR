// Captures the screenshots referenced by README/docs into docs/screenshots (needs a running server).
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://localhost:3210";
const out = "docs/screenshots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = async (route, name, full = false) => {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
};
await shot("/", "01-visio-general", true);
await shot("/territori?cmp=FIGUERES%7CAJUNTAMENT%20DE%20FIGUERES~GARRIGA%7CAJUNTAMENT%20DE%20LA%20GARRIGA", "02-territori", true);
await shot("/caracteritzacions", "03-explorador");
await shot("/caracteritzacions/31301", "04-fitxa-mostra", true);
// Photos from the SDR are not captured into the repository: reuse rights are not confirmed.
await shot("/patrons", "06-patrons");
await page.goto(`${base}/assistent`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Quins circuits han empitjorat més en impropis durant l'últim any amb dades comparables?" }).click();
await page.getByText("Dada observada").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Canvis i anomalies/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/08-assistent.png` });
const reports = await (await page.request.get(`${base}/api/reports`)).json();
const dossier = reports.reports.find((r) => r.findings > 0);
if (dossier) await shot(`/informes/${dossier.id}`, "09-informe", true);
await shot("/fonts", "10-fonts-qualitat", true);
await page.setViewportSize({ width: 390, height: 844 });
await shot("/", "11-mobil-visio-general");
await browser.close();
console.log("done");
