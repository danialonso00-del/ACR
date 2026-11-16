import "server-only";
/**
 * Deterministic research pipeline: question → proposed scope & sources →
 * analyses executed in code → verifiable dossier. Every number in the dossier
 * comes from the analytics module; the text is templated, not model-generated.
 */
import { buildScope } from "@/lib/analytics/scope";
import { aggregateImpropis, anomalies, changeAnalysis, composition, ESTIMATOR_INFO, persistentChanges, seasonality, timeSeries } from "@/lib/analytics/metrics";
import type { Filters } from "@/lib/analytics/filters";
import { getDataset } from "@/lib/data/repository";
import { comarcaNames } from "@/lib/geo/comarques";
import { CATEGORY_LABEL } from "@/lib/categories";
import { COMPOSITION_KEYS } from "@/lib/data/types";
import { fmtNum, fmtPct, fmtPp } from "@/lib/format";
import { newReportId } from "./store";
import type { Report, ReportFinding } from "./types";

export function scopeLabelFor(filters: Filters & { from: string; to: string }, comarques: Map<string, string>, circuitName?: string): string {
  return [`${filters.from} → ${filters.to}`, filters.comarca ? (comarques.get(filters.comarca) ?? filters.comarca) : "Tota Catalunya", circuitName ?? (filters.circuit ? filters.circuit.split("|")[0] : "tots els circuits"), filters.stream].join(" · ");
}

export function emptyReport(title: string, question: string, filters: Filters): Report {
  const ds = getDataset(filters.mode, filters.importId);
  const scope = ds ? buildScope(ds.records, ds.meta, filters) : null;
  const now = new Date().toISOString();
  return {
    id: newReportId(),
    title,
    question,
    author: "Usuari de demostració (sense comptes)",
    createdAt: now,
    updatedAt: now,
    datasetId: ds?.meta.id ?? "—",
    mode: filters.mode,
    filters: scope ? { ...scope.filters } : { ...filters },
    scopeLabel: scope ? scopeLabelFor(scope.filters, comarcaNames(filters.mode)) : "—",
    plan: { scope: "", sources: [], analyses: [] },
    queries: [],
    results: null,
    summary: "",
    findings: [],
    hypotheses: [],
    limitations: [],
    nextSteps: [],
    items: [],
  };
}

export function runResearch(question: string, filters: Filters, title?: string): Report {
  const ds = getDataset(filters.mode, filters.importId);
  if (!ds) throw new Error("Dataset not available");
  const scope = buildScope(ds.records, ds.meta, filters);
  const f = scope.filters;
  const comarques = comarcaNames(f.mode);
  const circuitName = f.circuit ? ds.circuits.find((c) => c.key === f.circuit)?.label : undefined;
  const report = emptyReport(title?.trim() || question.slice(0, 120), question, filters);
  const at = () => new Date().toISOString();
  const est = f.estimator;
  report.scopeLabel = scopeLabelFor(f, comarques, circuitName);

  report.plan = {
    scope: `${report.scopeLabel}. Estimador: ${ESTIMATOR_INFO[est].label}. Mostres < 90 kg: ${f.lowMass === "exclude" ? "excloses" : "incloses"}. n mínima per a comparacions territorials: ${f.minN}.`,
    sources: [
      { name: ds.meta.label, url: f.mode === "public_snapshot" ? "https://sdr.arc.cat/cform/ListCaracteritzacions.do" : null, status: f.mode === "public_snapshot" ? "Verificada (captura " + (ds.meta.capturedTo ?? "").slice(0, 10) + ")" : f.mode === "synthetic_demo" ? "Sintètica" : "Importada" },
      { name: "Metodologia i diccionari de dades del projecte", url: null, status: "Documentació interna (docs/)" },
    ],
    analyses: [
      "Agregat d'impropis i cobertura (n, circuits, exclusions)",
      "Sèrie temporal anual amb buits explícits",
      "Composició per categoria (mateix denominador)",
      "Canvi darrers 12 mesos vs 12 anteriors, cohort estable i per circuit",
      "Canvis persistents i anomalies robustes per circuit",
      "Estacionalitat mensual (Kruskal–Wallis) si hi ha prou dades",
    ],
  };

  const agg = aggregateImpropis(scope.valid, est);
  report.queries.push({ tool: "get_metric", input: { ...f, metric: "impropis_pct" }, at: at() });
  const series = timeSeries(scope.valid, f.from, f.to, "year", est);
  report.queries.push({ tool: "get_metric", input: { metric: "impropis_pct", groupBy: "year" }, at: at() });
  const comp = composition(scope.valid, est);
  report.queries.push({ tool: "get_metric", input: { metric: "composition" }, at: at() });
  const change = changeAnalysis(scope.history, f.to, 12);
  report.queries.push({ tool: "find_anomalies", input: { kind: "change_12m", to: f.to }, at: at() });
  const persistent = persistentChanges(scope.history, f.to).slice(0, 10);
  report.queries.push({ tool: "find_anomalies", input: { kind: "persistent" }, at: at() });
  const anom = anomalies(scope.history, scope.valid).slice(0, 10);
  report.queries.push({ tool: "find_anomalies", input: { kind: "outliers", z: 3.5 }, at: at() });
  const season = seasonality(scope.valid);
  report.queries.push({ tool: "get_metric", input: { metric: "seasonality" }, at: at() });

  report.results = {
    kpis: [
      { label: "Mostres vàlides", value: fmtNum(scope.valid.length), detail: `de ${fmtNum(scope.inScope.length)} a l'àmbit` },
      { label: "Circuits", value: fmtNum(agg.circuits), detail: "amb mostres vàlides" },
      { label: "Impropis", value: fmtPct(agg.value, 2), detail: ESTIMATOR_INFO[est].label },
      { label: "Variació 12 m (cohort)", value: fmtPp(change.cohort.diffPp, 2), detail: `${change.cohort.circuits} circuits · ${change.windows.cur[0]}–${change.windows.cur[1]}` },
    ],
    series: series.map((p) => ({ bucket: p.bucket, value: p.value, n: p.n })),
    composition: comp ? COMPOSITION_KEYS.filter((k) => k !== "form").map((k) => ({ label: CATEGORY_LABEL[k], pp: comp[k] })).sort((a, b) => b.pp - a.pp) : [],
    exclusions: scope.exclusions.map((e) => ({ label: e.label, count: e.count })),
  };

  const findings: ReportFinding[] = [];
  if (change.cohort.diffPp !== null) {
    findings.push({
      title: `Variació interanual dels impropis a la cohort estable: ${fmtPp(change.cohort.diffPp, 2)}`,
      question: "Han canviat els impropis en els darrers 12 mesos amb circuits comparables?",
      period: `${change.windows.prev[0]}–${change.windows.prev[1]} vs ${change.windows.cur[0]}–${change.windows.cur[1]}`,
      cohort: `${change.cohort.circuits} circuits presents als dos períodes`,
      n: `${change.cohort.nPrev} → ${change.cohort.nCur} mostres`,
      method: "Diferència de mitjanes per mostra (pp) sobre la cohort estable",
      magnitude: `${fmtPct(change.cohort.meanPrev, 2)} → ${fmtPct(change.cohort.meanCur, 2)} (${fmtPp(change.cohort.diffPp, 2)})`,
      uncertainty: "No es calcula un interval agregat: les mostres d'un mateix circuit no són independents. Vegeu els intervals per circuit.",
      limitations: `Amb totes les mostres (sense cohort) la variació és ${fmtPp(change.allSamples.diffPp, 2)}. Canvis en la selecció de mostres o en la recollida poden influir.`,
      actions: "Revisar amb l'equip tècnic els circuits que més contribueixen i confirmar si hi ha hagut canvis operatius.",
      sampleIds: [],
      table: { columns: ["Categoria", "pp abans", "pp ara", "Δ pp"], rows: change.categories.slice(0, 6).map((c) => [CATEGORY_LABEL[c.key], c.prev, c.cur, c.deltaPp]) },
    });
  }
  const robust = change.circuits.filter((c) => c.robust).slice(0, 8);
  if (robust.length) {
    findings.push({
      title: `${change.circuits.filter((c) => c.robust && c.diffPp > 0).length} circuits empitjoren i ${change.circuits.filter((c) => c.robust && c.diffPp < 0).length} milloren de manera robusta`,
      question: "Quins circuits han canviat més amb dades comparables?",
      period: `${change.windows.prev[0]}–${change.windows.cur[1]}`,
      cohort: `Circuits amb ≥ ${change.minPerWindow} mostres a cada període (${change.circuits.length} avaluats; ${change.excludedCircuits} sense prou mostres)`,
      n: robust.map((c) => `${c.circuitName}: ${c.nPrev}→${c.nCur}`).join("; "),
      method: "Diferència de mitjanes (Welch) per circuit amb IC 95 % aproximat; robust si l'interval no inclou 0",
      magnitude: robust.map((c) => `${c.circuitName} ${fmtPp(c.diffPp, 1)}`).join("; "),
      uncertainty: "Intervals amplis amb poques mostres per circuit (3–5 per any és habitual).",
      limitations: "No s'ajusta per comparacions múltiples; alguns resultats poden ser falsos positius.",
      actions: "Contrastar amb les fotografies i observacions dels butlletins citats abans de prendre decisions.",
      sampleIds: robust.flatMap((c) => c.sampleIds).slice(0, 200),
      table: { columns: ["Circuit", "n abans", "n ara", "% abans", "% ara", "Δ pp", "IC 95 %"], rows: robust.map((c) => [c.circuitName, c.nPrev, c.nCur, c.meanPrev, c.meanCur, c.diffPp, `${c.lo} a ${c.hi}`]) },
    });
  }
  if (persistent.length) {
    findings.push({
      title: `${persistent.length} circuits amb canvi persistent (no només un pic)`,
      question: "Hi ha canvis sostinguts en les darreres mostres?",
      period: `Fins a ${f.to}`,
      cohort: "Circuits amb ≥ 12 mostres",
      n: "12 últimes mostres per circuit",
      method: "Mediana de les 4 últimes vs mediana de les 8 anteriors; ≥ 3 de 4 fora de mediana ± MAD",
      magnitude: persistent.map((p) => `${p.circuitName} ${fmtPp(p.shiftPp, 1)}`).slice(0, 6).join("; "),
      uncertainty: "Regla heurística; no és un test formal.",
      limitations: "Sensibles a canvis de calendari de mostreig.",
      actions: "Seguiment a les properes campanyes.",
      sampleIds: persistent.flatMap((p) => p.sampleIds).slice(0, 200),
    });
  }
  if (anom.length) {
    findings.push({
      title: `${anom.length} mostres atípiques respecte de l'historial del seu circuit`,
      question: "Hi ha mostres anòmales que calgui revisar?",
      period: `${f.from}–${f.to}`,
      cohort: "Circuits amb ≥ 9 mostres d'historial",
      n: `${anom.length} mostres marcades`,
      method: "z robust = (x − mediana) / MAD; |z| ≥ 3,5",
      magnitude: anom.slice(0, 5).map((a) => `${a.id} (${a.circuitName}): ${fmtPct(a.value, 1)} vs mediana ${fmtPct(a.baselineMedian, 1)}`).join("; "),
      uncertainty: "La classificació error de dades / incidència operativa és orientativa.",
      limitations: "Una anomalia no implica error: cal revisió humana.",
      actions: `${anom.filter((a) => a.kind === "possible_error_dades").length} amb indicis d'error de dades (revisar registre); la resta, possibles incidències operatives (revisar fotos i observacions).`,
      sampleIds: anom.map((a) => a.id),
    });
  }
  if (season.eligible && season.kruskal) {
    findings.push({
      title: `Estacionalitat: amplitud mensual de ${fmtPp(season.amplitudePp, 1)} (p = ${season.kruskal.p < 0.001 ? "< 0,001" : fmtNum(season.kruskal.p, 3)})`,
      question: "Hi ha diferències sistemàtiques entre mesos?",
      period: `${f.from}–${f.to}`,
      cohort: "Totes les mostres vàlides de l'àmbit",
      n: `${season.kruskal.N} mostres`,
      method: "Kruskal–Wallis entre mesos de presa de mostra",
      magnitude: `Amplitud entre mitjanes mensuals ${fmtPp(season.amplitudePp, 2)}`,
      uncertainty: "La composició de circuits per mes pot variar (efecte de composició).",
      limitations: "Associació descriptiva; no explica causes.",
      actions: "Considerar el mes en comparar campanyes.",
      sampleIds: [],
      table: { columns: ["Mes", "n", "% mitjà"], rows: season.byMonth.map((m) => [m.month, m.n, m.mean]) },
    });
  }
  report.findings = findings;

  report.summary = [
    `Àmbit analitzat: ${report.scopeLabel}. ${fmtNum(scope.valid.length)} mostres vàlides de ${fmtNum(agg.circuits)} circuits (${fmtNum(scope.inScope.length - scope.valid.length)} excloses).`,
    `Impropis (${ESTIMATOR_INFO[est].label.toLowerCase()}): ${fmtPct(agg.value, 2)}.`,
    change.cohort.diffPp !== null ? `Darrers 12 mesos vs anteriors, cohort estable de ${change.cohort.circuits} circuits: ${fmtPp(change.cohort.diffPp, 2)}.` : "No hi ha prou dades per comparar els darrers 12 mesos.",
    comp ? `Categories principals: ${COMPOSITION_KEYS.filter((k) => !["form", "fv", "perdues"].includes(k)).sort((a, b) => comp[b] - comp[a]).slice(0, 3).map((k) => `${CATEGORY_LABEL[k]} (${fmtNum(comp[k], 2)} pp)`).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  report.hypotheses = [
    "Hipòtesi: els circuits amb augments robustos poden reflectir canvis en el sistema de recollida o en la composició de la població servida; cal verificar-ho amb l'equip tècnic.",
    "Hipòtesi: part de la variació agregada pot deure's a canvis en quins circuits es mostregen; la cohort estable ho limita però no ho elimina.",
  ];
  report.limitations = [
    "Extracte públic del SDR: només butlletins acceptats visibles a la consulta pública; anys carregats: " + ds.meta.yearsLoaded.join(", ") + ".",
    "Indicador exploratori per massa caracteritzada; no és un indicador oficial ajustat ni ponderat per tones recollides.",
    "Els circuits supracomarcals no es reparteixen entre comarques.",
    "La regla de representativitat (< 90 kg) s'aplica sense conèixer el motiu de l'aturada (no consta a l'exportació).",
    "Les correlacions i diferències temporals no demostren causalitat.",
  ];
  report.nextSteps = [
    "Validar amb l'ARC el diccionari, les fórmules i els factors correctors per versió de protocol.",
    "Ampliar la ingesta als anys 2007–2018 i comprovar canvis metodològics.",
    "Obtenir tones recollides per circuit per calcular mitjanes ponderades.",
    "Revisar les mostres atípiques amb fotografies i observacions.",
  ];
  return report;
}
