import "server-only";
/**
 * "Mode demostració sense model connectat": deterministic guided queries that
 * run the same typed tools as the LLM agent and render templated text. This
 * is explicitly NOT a language model and never pretends to be one.
 */
import type { Filters } from "@/lib/analytics/filters";
import { buildScope } from "@/lib/analytics/scope";
import { getDataset } from "@/lib/data/repository";
import { executeTool, type ToolName, type ToolOutput } from "./tools";
import type { AgentEvent } from "./agent";

export const GUIDED_QUERIES = [
  { id: "worsening", label: "Quins circuits han empitjorat més en impropis durant l'últim any amb dades comparables?" },
  { id: "drivers", label: "Quines fraccions expliquen aquest canvi?" },
  { id: "seasonality", label: "Hi ha estacionalitat en aquest circuit?" },
  { id: "photos", label: "Mostra les fotos associades a aquestes caracteritzacions." },
  { id: "limitations", label: "Quines limitacions té aquesta comparació?" },
  { id: "report", label: "Prepara un resum per a l'equip tècnic amb fonts." },
] as const;
export type GuidedId = (typeof GUIDED_QUERIES)[number]["id"];

const pct = (v: unknown, d = 2) => (typeof v === "number" ? `${v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d })} %` : "—");
const num = (v: number, d = 1) => v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const MONTHS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
const pp = (v: unknown, d = 2) => (typeof v === "number" ? `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d })} pp` : "—");

export async function runGuided(opts: { id: GuidedId; filters: Filters; scopeLabel: string; origin: string; emit: (e: AgentEvent) => void }) {
  const { emit } = opts;
  emit({ type: "meta", mode: "guided", scope: opts.scopeLabel });
  let n = 0;
  const call = async (name: ToolName, input: Record<string, unknown>): Promise<ToolOutput> => {
    const id = `guided-${++n}`;
    emit({ type: "tool_call", id, name, input });
    const out = await executeTool(name, input, { baseFilters: opts.filters, origin: opts.origin });
    emit({ type: "tool_result", id, name, ok: true, output: out });
    return out;
  };
  const say = (t: string) => emit({ type: "text", delta: t });
  say("_Resposta generada amb una plantilla determinista a partir de les eines (sense model de llenguatge)._\n\n");

  try {
    switch (opts.id) {
      case "worsening":
      case "drivers": {
        const out = await call("find_anomalies", { kind: "worsening", limit: 8 });
        const r = out.result as { robust_total: number; direction_total: number; windows: { prev: string[]; cur: string[] }; stable_cohort: { circuits: number; meanPrev: number | null; meanCur: number | null; diffPp: number | null; nPrev: number; nCur: number }; ranking: { circuit: string; n_prev: number; n_cur: number; mean_prev: number; mean_cur: number; diff_pp: number; robust: boolean; ci95: number[]; top_categories: { category: string; delta_pp: number }[] }[]; category_drivers_pp: { category: string; delta_pp: number }[]; circuits_evaluated: number; circuits_without_enough_samples: number };
        say(`**Dada observada**\n`);
        say(`- Períodes: ${r.windows.prev.join("–")} vs ${r.windows.cur.join("–")} (data de presa de mostra).\n`);
        say(`- Cohort estable (${r.stable_cohort.circuits} circuits presents als dos períodes): ${pct(r.stable_cohort.meanPrev)} → ${pct(r.stable_cohort.meanCur)} (${pp(r.stable_cohort.diffPp)}; n ${r.stable_cohort.nPrev} → ${r.stable_cohort.nCur}).\n`);
        if (opts.id === "worsening") {
          say(`- ${r.circuits_evaluated} circuits amb ≥ 3 mostres a cada període (${r.circuits_without_enough_samples} sense prou mostres). ${r.direction_total} augmenten; ${r.robust_total} de manera robusta (IC 95 % aproximat sense 0). Primer els robustos, per magnitud:\n`);
          for (const c of r.ranking.slice(0, 6)) say(`  - **${c.circuit}**: ${pct(c.mean_prev, 1)} → ${pct(c.mean_cur, 1)} (${pp(c.diff_pp, 1)}; IC ${num(c.ci95[0]!)} a ${num(c.ci95[1]!)} pp; n ${c.n_prev}→${c.n_cur})${c.robust ? "" : " — no robust"}\n`);
        } else {
          say(`- Categories que més varien a la cohort estable (pp sobre la massa de referència):\n`);
          for (const c of r.category_drivers_pp) say(`  - ${c.category}: ${pp(c.delta_pp)}\n`);
          const top = r.ranking[0];
          if (top) say(`- Al circuit que més empitjora (${top.circuit}), les categories amb més variació són: ${top.top_categories.map((t) => `${t.category} ${pp(t.delta_pp, 1)}`).join(", ")}.\n`);
        }
        say(`\n**Hipòtesi**\n- Els augments poden respondre a canvis operatius, de població servida o de calendari de mostreig; no es pot atribuir causa amb aquestes dades.\n`);
        say(`\n**Recomanació**\n- Revisar els butlletins dels circuits citats (fotos i observacions) i confirmar-ho amb l'equip tècnic abans d'actuar.\n- Tenir en compte que no hi ha correcció per comparacions múltiples.\n`);
        break;
      }
      case "seasonality": {
        const out = await call("get_metric", { metric: "seasonality" });
        const r = out.result as { eligible: boolean; reason: string | null; amplitude_pp: number | null; kruskal_wallis: { H: number; p_value: number; N: number } | null; by_month: { month: number; n: number; mean: number | null }[] };
        say(`**Dada observada**\n`);
        if (!opts.filters.circuit) say(`- Àmbit sense circuit seleccionat: l'anàlisi barreja circuits. Selecciona un circuit a la barra de filtres per a una lectura per circuit.\n`);
        if (!r.eligible) {
          say(`- No hi ha prou dades per avaluar l'estacionalitat: ${r.reason}\n`);
        } else {
          const ranked = r.by_month.filter((m) => m.mean !== null).sort((a, b) => b.mean! - a.mean!);
          say(`- Amplitud entre mitjanes mensuals: ${pp(r.amplitude_pp)} (mes més alt: ${MONTHS[(ranked[0]?.month ?? 1) - 1]}, ${pct(ranked[0]?.mean)}; més baix: ${MONTHS[(ranked.at(-1)?.month ?? 1) - 1]}, ${pct(ranked.at(-1)?.mean)}).\n`);
          say(`- Kruskal–Wallis: H = ${num(r.kruskal_wallis!.H)}, p ${r.kruskal_wallis!.p_value < 0.001 ? "< 0,001" : `= ${num(r.kruskal_wallis!.p_value, 3)}`}, N = ${r.kruskal_wallis!.N}.\n`);
        }
        say(`\n**Hipòtesi**\n- Diferències mensuals poden reflectir hàbits estacionals o canvis en quins circuits es mostregen cada mes (efecte de composició).\n`);
        say(`\n**Recomanació**\n- Comparar campanyes del mateix mes i, si cal, fixar una cohort de circuits.\n`);
        break;
      }
      case "photos": {
        const ds = getDataset(opts.filters.mode, opts.filters.importId);
        const scope = ds ? buildScope(ds.records, ds.meta, opts.filters) : null;
        const ids = scope ? scope.inScope.filter((r) => (ds!.photoChecks.get(r.id)?.photos ?? 0) > 0).sort((a, b) => (b.dates.sampling ?? "").localeCompare(a.dates.sampling ?? "")).slice(0, 8).map((r) => r.id) : [];
        if (!ids.length) {
          say(`**Dada observada**\n- Cap mostra de l'àmbit té galeria indexada. Les galeries es poden consultar en viu des de cada fitxa.\n`);
          break;
        }
        const out = await call("get_photos", { bulletin_ids: ids });
        const r = out.result as { bulletins: { id: string; photos: number; types: string[] }[] };
        say(`**Dada observada**\n- ${ids.length} butlletins recents de l'àmbit amb fotografies indexades:\n`);
        for (const b of r.bulletins) say(`  - [${b.id}](/caracteritzacions/${b.id}): ${b.photos} imatges (${b.types.slice(0, 4).join(", ")}${b.types.length > 4 ? "…" : ""})\n`);
        say(`\n**Recomanació**\n- Obre l'Arxiu visual per comparar mostres. Les imatges no permeten inferir pesos; drets de reutilització pendents de confirmar.\n`);
        break;
      }
      case "limitations": {
        const cov = await call("get_metric", { metric: "coverage" });
        const docs = await call("search_documents", { query: "limitacions representativitat denominador cohort estable supracomarcal" });
        const c = cov.result as { in_scope: number; valid: number; circuits: number; exclusions: { label: string; count: number }[]; years_loaded: number[] };
        say(`**Dada observada**\n- Àmbit: ${c.in_scope} mostres, ${c.valid} analitzables, ${c.circuits} circuits. Anys carregats: ${c.years_loaded.join(", ")}.\n`);
        for (const e of c.exclusions) say(`- Exclusió: ${e.label} (${e.count}).\n`);
        say(`\n**Limitacions metodològiques** (de la documentació del projecte)\n`);
        for (const h of (docs.result as { results: { document: string; section: string }[] }).results) say(`- ${h.section} (${h.document})\n`);
        say(`- Indicador exploratori per massa caracteritzada; no és oficial ni ponderat per tones.\n- Pocs mostres per circuit i any: intervals amplis.\n- Les correlacions no impliquen causalitat.\n`);
        say(`\n**Recomanació**\n- Validar fórmules i factors per versió de protocol amb l'ARC; ampliar la ingesta d'anys.\n`);
        break;
      }
      case "report": {
        const out = await call("create_report", { title: `Resum per a l'equip tècnic — ${opts.scopeLabel}`.slice(0, 160), question: "Resum de l'estat dels impropis a l'àmbit actual, canvis recents i limitacions" });
        const r = out.result as { url: string; summary: string; findings: string[] };
        say(`**Dada observada**\n${r.summary}\n\n**Troballes desades**\n${r.findings.map((f) => `- ${f}`).join("\n")}\n\n**Recomanació**\n- Revisa i edita el dossier: [obrir l'informe](${r.url.replace(opts.origin, "")}). Exportable a PDF i CSV.\n`);
        break;
      }
    }
    emit({ type: "done", stop: "guided" });
  } catch (err) {
    emit({ type: "error", message: (err as Error).message });
    emit({ type: "done", stop: "error" });
  }
}
