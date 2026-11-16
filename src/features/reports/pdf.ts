"use client";
/**
 * Client-side PDF export with selectable text, vector bar charts and real
 * tables (jsPDF + autotable). Standard PDF fonts only cover WinAnsi, so a few
 * symbols are transliterated.
 */
import type { Report } from "./types";

const MAP: Record<string, string> = { "→": "->", "≥": ">=", "≤": "<=", "Δ": "Delta ", "−": "-", "≈": "~", "✓": "v", "▲": "+", "▼": "-", "×": "x", "Σ": "Suma ", "…": "...", "’": "'", "“": '"', "”": '"' };
const clean = (s: unknown) => String(s ?? "—").replace(/[→≥≤Δ−≈✓▲▼×Σ…’“”]/g, (c) => MAP[c] ?? "").replace(/[^\u0000-ÿ–—]/g, "");

export async function exportReportPdf(r: Report) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const green: [number, number, number] = [8, 120, 60];
  const ink: [number, number, number] = [29, 29, 27];
  const muted: [number, number, number] = [96, 102, 95];

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (t: string, size = 13) => {
    ensure(size + 18);
    y += 8;
    doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(...ink);
    doc.text(clean(t), M, y);
    y += size + 4;
  };
  const para = (t: string, size = 9.5, color = ink) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(clean(t), W - 2 * M) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, M, y);
      y += size + 3.5;
    }
    y += 3;
  };
  const table = (head: string[], body: (string | number | null)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head.map(clean)],
      body: body.map((row) => row.map((c) => clean(c === null ? "—" : typeof c === "number" ? c.toLocaleString("ca-ES", { maximumFractionDigits: 3 }) : c))),
      margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3, textColor: ink, lineColor: [227, 231, 223], lineWidth: 0.5 },
      headStyles: { fillColor: [246, 247, 244], textColor: muted, fontStyle: "bold" },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  // Header
  doc.setFillColor(...green).rect(0, 0, W, 6, "F");
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...muted);
  doc.text(clean("ARC · Intel·ligència de Residus — Demostració tecnològica · MTI (no és un servei oficial de l'ARC)"), M, y);
  y += 22;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ink);
  for (const line of doc.splitTextToSize(clean(r.title), W - 2 * M) as string[]) {
    doc.text(line, M, y);
    y += 22;
  }
  para(`Pregunta: ${r.question}`, 10, muted);
  para(`Àmbit: ${r.scopeLabel} · Dataset: ${r.datasetId} (${r.mode}) · Generat: ${r.createdAt.slice(0, 16).replace("T", " ")} UTC · Actualitzat: ${r.updatedAt.slice(0, 16).replace("T", " ")} UTC`, 8.5, muted);

  heading("Resum executiu");
  para(r.summary || "—");

  if (r.results) {
    table(["Indicador", "Valor", "Detall"], r.results.kpis.map((k) => [k.label, k.value, k.detail]));
    // Vector bar chart of the yearly series (empty years drawn as gaps).
    const s = r.results.series;
    if (s.length) {
      heading("Evolució anual del % d'impropis", 11);
      const ch = 130;
      ensure(ch + 30);
      const max = Math.max(1, ...s.map((p) => p.value ?? 0));
      const bw = (W - 2 * M) / s.length;
      doc.setDrawColor(195, 194, 183).line(M, y + ch, W - M, y + ch);
      s.forEach((p, i) => {
        const x = M + i * bw + bw * 0.2;
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...muted);
        doc.text(clean(p.bucket), x + bw * 0.3, y + ch + 10, { align: "center" });
        if (p.value === null) {
          doc.text("sense dades", x + bw * 0.3, y + ch - 4, { align: "center" });
          return;
        }
        const h = (p.value / max) * (ch - 14);
        doc.setFillColor(42, 120, 214).rect(x, y + ch - h, bw * 0.6, h, "F");
        doc.setTextColor(...ink).text(p.value.toLocaleString("ca-ES", { maximumFractionDigits: 1 }), x + bw * 0.3, y + ch - h - 3, { align: "center" });
      });
      y += ch + 22;
      table(["Any", "% impropis", "n mostres"], s.map((p) => [p.bucket, p.value, p.n]));
    }
    if (r.results.composition.length) {
      heading("Composició (pp sobre la massa de referència)", 11);
      table(["Categoria", "pp"], r.results.composition.map((c) => [c.label, c.pp]));
    }
    if (r.results.exclusions.length) table(["Exclusió", "Mostres"], r.results.exclusions.map((e) => [e.label, e.count]));
  }

  if (r.findings.length) {
    heading("Troballes");
    r.findings.forEach((f, i) => {
      heading(`${i + 1}. ${f.title}`, 10.5);
      table(
        ["Camp", "Detall"],
        [
          ["Pregunta", f.question],
          ["Període", f.period],
          ["Cohort", f.cohort],
          ["Mida de mostra", f.n],
          ["Mètode", f.method],
          ["Magnitud", f.magnitude],
          ["Incertesa", f.uncertainty],
          ["Limitacions", f.limitations],
          ["Accions per a revisió humana", f.actions],
          ["Butlletins", f.sampleIds.slice(0, 40).join(", ") + (f.sampleIds.length > 40 ? ` … (+${f.sampleIds.length - 40})` : "")],
        ],
      );
      if (f.table) table(f.table.columns, f.table.rows);
    });
  }
  if (r.items.length) {
    heading("Elements afegits");
    r.items.forEach((it) => {
      heading(`${it.title} (${it.kind})`, 10);
      para(it.text);
      if (it.evidence?.length) table(["Eina", "Evidència", "n", "Dataset"], it.evidence.map((e) => [e.tool, e.summary, e.n ?? null, e.dataset ?? null]));
      if (it.table) table(it.table.columns, it.table.rows);
    });
  }
  heading("Hipòtesis (no verificades)");
  r.hypotheses.forEach((h) => para(`• ${h}`));
  heading("Limitacions");
  r.limitations.forEach((h) => para(`• ${h}`));
  heading("Propers passos");
  r.nextSteps.forEach((h) => para(`• ${h}`));
  heading("Annex: pla, fonts i consultes");
  para(r.plan.scope || "—");
  if (r.plan.sources.length) table(["Font", "URL", "Estat"], r.plan.sources.map((s) => [s.name, s.url, s.status]));
  if (r.queries.length) table(["Eina", "Paràmetres", "Hora"], r.queries.map((q) => [q.tool, JSON.stringify(q.input).slice(0, 160), q.at.slice(11, 19)]));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...muted);
    doc.text(clean(`${r.id} · pàgina ${i} de ${pages}`), W - M, H - 24, { align: "right" });
  }
  doc.save(`${r.id}.pdf`);
}
