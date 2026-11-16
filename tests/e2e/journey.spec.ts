import { expect, test } from "@playwright/test";

/**
 * Brief §11 journey: filter → circuit → sample → photo (or empty state) →
 * question → report (PDF + CSV). Runs without external services: the
 * assistant uses guided mode when no ANTHROPIC_API_KEY is configured.
 */
test("full journey from overview to exported report", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "De les mostres a les decisions" })).toBeVisible();
  await expect(page.getByText("Mostres vàlides analitzades")).toBeVisible();

  // Period preset → URL-persisted filter
  await page.getByRole("button", { name: "24 m", exact: true }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}/);

  // Circuit via the searchable combobox
  const circuit = page.getByRole("combobox", { name: "Circuit" }).first();
  await circuit.click();
  await circuit.fill("FIGUERES");
  await page.getByRole("option", { name: /^FIGUERES/ }).first().click();
  await expect(page).toHaveURL(/circuit=FIGUERES/);

  // Sidebar keeps the scope
  await page.getByRole("navigation", { name: "Seccions" }).getByRole("link", { name: "Caracteritzacions" }).click();
  await expect(page).toHaveURL(/\/caracteritzacions\?.*circuit=FIGUERES/);
  const firstRow = page.locator("tbody tr").first().getByRole("link").first();
  await expect(firstRow).toBeVisible();
  const bulletin = (await firstRow.textContent())!.trim();
  await firstRow.click();

  // Sample sheet with visible formula and tabs
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Butlletí ${bulletin}`) })).toBeVisible();
  await expect(page.getByText("Fórmula visible")).toBeVisible();
  await page.getByRole("tab", { name: "Fotografies" }).click();
  await expect(page.getByText(/imatges · origen|Fotografies no disponibles|no té imatges/).first()).toBeVisible({ timeout: 90_000 });
  await page.getByRole("tab", { name: /Qualitat i traçabilitat/ }).click();
  await expect(page.getByText("Hash de fila")).toBeVisible();

  // Ask the assistant (guided mode when no model is configured)
  await page.getByRole("link", { name: "Preguntar a l'assistent" }).click();
  await expect(page).toHaveURL(/\/assistent/);
  await page.getByRole("button", { name: "Quines fraccions expliquen aquest canvi?" }).click();
  await expect(page.getByText("Dada observada").first()).toBeVisible({ timeout: 60_000 });

  // Add the answer to a new report and export it
  await page.getByRole("button", { name: "Afegir a informe" }).last().click();
  await page.getByRole("button", { name: "+ Nou informe amb aquest element" }).click();
  await page.getByRole("link", { name: "Obrir l'informe →" }).click();
  await expect(page).toHaveURL(/\/informes\/r-\d{8}-[a-f0-9]{6}/);
  await expect(page.getByText("Elements afegits")).toBeVisible();
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^r-\d{8}-[a-f0-9]{6}\.pdf$/);
  const csv = await page.request.get(page.url().replace(/\/informes\/(r-[^/?]+).*/, "/api/reports/$1/csv"));
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain("Demostració tecnològica MTI");
});

test("investigation flow produces a verifiable dossier", async ({ page }) => {
  await page.goto("/informes?comarca=41");
  await page.getByLabel("Pregunta de recerca").fill("Com han evolucionat els impropis al Vallès Oriental?");
  await page.getByRole("button", { name: /Proposar abast i fonts/ }).click();
  await expect(page.getByText("Abast proposat (filtres actuals)")).toBeVisible();
  await page.getByRole("button", { name: /Executar l'anàlisi/ }).click();
  await expect(page.getByRole("heading", { name: "Troballes" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Pla, fonts i consultes")).toBeVisible();
});

test("numbers reconcile between explorer API, export and overview scope", async ({ request }) => {
  const q = "from=2025-01&to=2025-12&comarca=41";
  const api = await (await request.get(`/api/characterizations?${q}&size=5`)).json();
  expect(api.total).toBeGreaterThan(0);
  const csv = await (await request.get(`/api/export/characterizations?${q}`)).text();
  const dataLines = csv.split("\r\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("﻿#"));
  expect(dataLines.length - 1).toBe(api.total); // minus header row
  expect(csv).toContain("Fórmula: pp_categoria = 100 × kg × factor / (pes total + pèrdues)");
});

for (const width of [390, 768]) {
  test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/caracteritzacions", "/caracteritzacions/31301", "/territori", "/patrons", "/fonts", "/informes", "/assistent"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
}
