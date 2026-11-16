"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronDown,
  Copy,
  Database,
  FileText,
  Images,
  Layers,
  RotateCcw,
  ShieldAlert,
  Square,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/charts/chart-card";
import { BarsWithN, DivergingBars } from "@/components/charts/charts";
import { AddToReportButton } from "@/features/reports/add-to-report";
import { cn } from "@/lib/format";
import { Markdown } from "./markdown";
import { AiOrb } from "./orb";
import type { AgentEvent } from "@/lib/ai/agent";
import type { ToolOutput } from "@/lib/ai/tools";

export const SUGGESTED = [
  { id: "worsening", label: "Quins circuits han empitjorat més en impropis durant l'últim any amb dades comparables?", tag: "Canvis", icon: TrendingUp },
  { id: "drivers", label: "Quines fraccions expliquen aquest canvi?", tag: "Composició", icon: Layers },
  { id: "seasonality", label: "Hi ha estacionalitat en aquest circuit?", tag: "Temporal", icon: CalendarRange },
  { id: "photos", label: "Mostra les fotos associades a aquestes caracteritzacions.", tag: "Arxiu visual", icon: Images },
  { id: "limitations", label: "Quines limitacions té aquesta comparació?", tag: "Mètode", icon: ShieldAlert },
  { id: "report", label: "Prepara un resum per a l'equip tècnic amb fonts.", tag: "Informe", icon: FileText },
];

const TOOL_LABEL: Record<string, string> = {
  get_metric: "Mètrica",
  compare_circuits: "Comparació de circuits",
  find_anomalies: "Canvis i anomalies",
  get_sample: "Fitxa de mostra",
  search_documents: "Documentació",
  get_photos: "Fotografies",
  create_report: "Informe",
};

interface ToolRun {
  id: string;
  name: string;
  input: unknown;
  ok?: boolean;
  output?: ToolOutput;
  error?: string;
}
interface Turn {
  role: "user" | "assistant";
  text: string;
  tools: ToolRun[];
  mode?: "llm" | "guided";
  model?: string;
  error?: string;
  done?: boolean;
  usage?: { inputTokens: number; outputTokens: number; rounds: number };
  scope?: string;
}

function StepIcon({ run }: { run: ToolRun }) {
  if (run.ok === undefined)
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-surface ring-1 ring-g-200">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-g-200 border-t-g-600" />
      </span>
    );
  if (run.ok)
    return (
      <span className="check-pop grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-white shadow-[var(--brand-glow)]">
        <Check size={13} strokeWidth={3} aria-hidden />
      </span>
    );
  return (
    <span className="check-pop grid h-6 w-6 place-items-center rounded-full bg-danger-tint text-danger ring-1 ring-danger/30">
      <AlertTriangle size={12} aria-hidden />
    </span>
  );
}

function ToolStep({ run, filters, last }: { run: ToolRun; filters: Record<string, unknown>; last: boolean }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const ev = run.output?.evidence;
  const chart = run.output?.chart;
  const toggle = () => {
    setSeen(true);
    setOpen(!open);
  };
  return (
    <li className="msg-in relative flex gap-3 pb-2.5 last:pb-0">
      {!last ? <span aria-hidden className="absolute bottom-0 left-[11.5px] top-7 w-px bg-gradient-to-b from-g-300 to-line" /> : null}
      <div className="relative z-[1] pt-1.5">
        <StepIcon run={run} />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface text-[12.5px] transition-shadow duration-200 hover:shadow-[var(--shadow-card)]">
        <button onClick={toggle} className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open}>
          <span className={cn("font-semibold text-ink", run.ok === undefined && "shimmer-text")}>{TOOL_LABEL[run.name] ?? run.name}</span>
          <code className="hidden min-w-0 truncate text-[11px] text-subtle sm:block">{run.name}({JSON.stringify(run.input).slice(0, 80)})</code>
          {ev ? <span className="ml-auto shrink-0 rounded-full bg-g-50 px-2 py-0.5 text-[11px] font-semibold text-g-700 dark:text-[var(--focus)]">n = {ev.n}</span> : <span className="ml-auto" />}
          <ChevronDown size={14} className={cn("shrink-0 text-subtle transition-transform duration-300", open && "rotate-180")} aria-hidden />
        </button>
        {ev?.scopeChange ? <p className="mx-3 mb-2 rounded-lg bg-warn-tint px-2.5 py-1 text-[11.5px] text-warn">{ev.scopeChange}</p> : null}
        {run.error ? <p className="px-3 pb-2 text-danger">{run.error}</p> : null}
        <div className="disclosure" data-open={open} inert={!open}>
          <div>
            {seen && run.output ? (
              <div className="flex flex-col gap-2 border-t border-line bg-surface-2/60 px-3 py-2.5">
                <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
                  <dt className="text-muted">Dataset</dt>
                  <dd>{ev!.dataset} ({ev!.mode})</dd>
                  <dt className="text-muted">Període</dt>
                  <dd>{ev!.period}</dd>
                  <dt className="text-muted">Filtres</dt>
                  <dd className="break-all">{JSON.stringify(ev!.filters)}</dd>
                  <dt className="text-muted">Unitat</dt>
                  <dd>{ev!.unit}</dd>
                  <dt className="text-muted">Denominador</dt>
                  <dd>{ev!.denominator}</dd>
                  {ev!.estimator ? (
                    <>
                      <dt className="text-muted">Estimador</dt>
                      <dd>{ev!.estimator}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted">Butlletins</dt>
                  <dd>
                    {ev!.sampleCount ? (
                      <>
                        {ev!.sampleIds.slice(0, 12).map((sid, i) => (
                          <span key={sid}>
                            {i ? ", " : ""}
                            <Link href={`/caracteritzacions/${sid}`} className="text-g-700 hover:underline dark:text-[var(--focus)]">{sid}</Link>
                          </span>
                        ))}
                        {ev!.sampleCount > 12 ? ` … (${ev!.sampleCount} en total)` : ""}
                      </>
                    ) : "—"}
                  </dd>
                  <dt className="text-muted">Enllaços</dt>
                  <dd className="flex flex-wrap gap-x-2">
                    {ev!.links.map((l) => (
                      <a key={l.href} href={l.href.replace(/^https?:\/\/[^/]+(?=\/(caracteritzacions|informes|fonts))/, "")} className="text-g-700 underline-offset-2 hover:underline dark:text-[var(--focus)]" target={l.href.includes("sdr.arc.cat") ? "_blank" : undefined} rel="noreferrer noopener">
                        {l.label}
                      </a>
                    ))}
                  </dd>
                </dl>
                {run.output.table ? (
                  <DataTable spec={{ columns: run.output.table.columns.map((c, i) => ({ key: String(i), label: c, align: i ? "right" : "left" })), rows: run.output.table.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) }} maxHeight={220} />
                ) : (
                  <pre className="max-h-56 overflow-auto rounded-lg bg-surface p-2 text-[11px] leading-snug">{JSON.stringify(run.output.result, null, 1)}</pre>
                )}
                <div className="flex justify-end">
                  <AddToReportButton
                    label="Afegir resultat a informe"
                    item={{
                      kind: "finding",
                      title: `${TOOL_LABEL[run.name] ?? run.name}: ${chart?.title ?? run.name}`,
                      text: `Resultat de l'eina ${run.name} (${ev!.period}). ${ev!.scopeChange ?? ""}`.trim(),
                      sampleIds: ev!.sampleIds,
                      filters: filters as never,
                      evidence: [{ tool: run.name, summary: `${ev!.unit}; denominador: ${ev!.denominator}`, n: ev!.n, period: ev!.period, dataset: ev!.dataset }],
                      table: run.output.table ? { columns: run.output.table.columns, rows: run.output.table.rows.slice(0, 50) } : undefined,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {chart && chart.rows.length ? (
          <div className="animate-in border-t border-line px-2 py-1">
            <p className="px-1 pt-1.5 text-[11.5px] font-semibold text-muted">{chart.title}</p>
            {chart.kind === "diverging" ? (
              <DivergingBars rows={chart.rows.map((r) => ({ label: r.label, value: r.value ?? 0, n: r.n !== undefined ? `n = ${r.n}` : undefined }))} unit={chart.unit} />
            ) : (
              <BarsWithN rows={chart.rows.map((r) => ({ label: r.label, value: r.value, n: r.n ?? 0 }))} yName={chart.unit} height={200} />
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (permissions or insecure context) */
    }
  };
  return (
    <button onClick={copy} className="press inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-medium text-muted hover:bg-g-50 hover:text-ink" aria-live="polite">
      {copied ? <Check size={14} className="check-pop text-g-600" aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? "Copiat" : "Copiar"}
    </button>
  );
}

function Thinking({ tools }: { tools: ToolRun[] }) {
  const running = tools.find((r) => r.ok === undefined);
  return (
    <span className="inline-flex items-center gap-2.5 py-1 text-[13px]">
      <span className="typing-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="shimmer-text font-medium">{running ? `Consultant: ${TOOL_LABEL[running.name] ?? running.name}…` : tools.length ? "Redactant la resposta…" : "Analitzant les dades…"}</span>
    </span>
  );
}

export function Chat({ filters, scopeLabel, aiConfigured, sampleId, compact = false }: { filters: Record<string, unknown>; scopeLabel: string; aiConfigured: boolean; sampleId?: string; compact?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<unknown[]>([]);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const synthetic = filters.mode === "synthetic_demo";

  // Follow the stream only while the reader is near the bottom, so scrolling up to read is not hijacked.
  useEffect(() => {
    const el = scroller.current;
    if (!el || turns.length === 0) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const update = (fn: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), fn(ts.at(-1)!)]);

  const send = async (payload: { question?: string; guided?: string; label: string }) => {
    if (busy) return;
    setBusy(true);
    setTurns((ts) => [...ts, { role: "user", text: payload.label, tools: [] }, { role: "assistant", text: "", tools: [] }]);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, question: payload.question, guided: payload.guided, sampleId, history: payload.guided ? [] : history.current }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AgentEvent;
          if (e.type === "text") update((t) => ({ ...t, text: t.text + e.delta }));
          else if (e.type === "meta") update((t) => ({ ...t, mode: e.mode, model: e.model, scope: e.scope }));
          else if (e.type === "tool_call") update((t) => ({ ...t, tools: [...t.tools, { id: e.id, name: e.name, input: e.input }] }));
          else if (e.type === "tool_result") update((t) => ({ ...t, tools: t.tools.map((r) => (r.id === e.id ? { ...r, ok: e.ok, output: e.output, error: e.error } : r)) }));
          else if (e.type === "usage") update((t) => ({ ...t, usage: { inputTokens: e.inputTokens, outputTokens: e.outputTokens, rounds: e.rounds } }));
          else if (e.type === "history") history.current = e.messages;
          else if (e.type === "error") update((t) => ({ ...t, error: e.message }));
          else if (e.type === "done") update((t) => ({ ...t, done: true }));
        }
      }
    } catch (err) {
      const msg = (err as Error).name === "AbortError" ? "Consulta cancel·lada." : (err as Error).message;
      update((t) => ({ ...t, error: msg, done: true }));
    } finally {
      setBusy(false);
      abort.current = null;
      update((t) => ({ ...t, done: true }));
    }
  };

  const resize = () => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const q = input.trim();
    if (!q || !aiConfigured) return;
    setInput("");
    requestAnimationFrame(resize);
    send({ question: q, label: q });
  };

  const reset = () => {
    setTurns([]);
    history.current = [];
  };

  const ask = (s: (typeof SUGGESTED)[number]) => (aiConfigured ? send({ question: s.label, label: s.label }) : send({ guided: s.id, label: s.label }));

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "h-full" : "h-[calc(100dvh-384px)] min-h-[520px]")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[12px]">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-muted" title={scopeLabel}>
          <Database size={13} className="shrink-0 text-g-600 dark:text-[var(--focus)]" aria-hidden />
          <span className="truncate">Àmbit: {scopeLabel}</span>
        </span>
        {synthetic ? <Badge tone="synthetic">sintètic</Badge> : null}
        {aiConfigured ? (
          <Badge tone="brand" className="h-6">
            <span aria-hidden className="live-dot !h-1.5 !w-1.5 text-g-500" /> Model connectat
          </Badge>
        ) : (
          <Badge tone="warn" className="h-6">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" /> Mode demostració sense model connectat
          </Badge>
        )}
        {turns.length ? (
          <button onClick={reset} disabled={busy} className="press inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium text-muted hover:bg-g-50 hover:text-ink disabled:opacity-40">
            <RotateCcw size={12} aria-hidden /> Nova conversa
          </button>
        ) : null}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {turns.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pb-2 pt-4 text-center">
            <div className="rise relative">
              <AiOrb size={compact ? 56 : 68} halo />
            </div>
            <h2 className="rise mt-5 text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[24px]" style={{ animationDelay: "60ms" }}>
              Hola! Què vols descobrir de les dades?
            </h2>
            <p className="rise mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted" style={{ animationDelay: "110ms" }}>
              {aiConfigured
                ? "El model consulta eines tipades sobre les dades autoritzades. Cada xifra porta període, unitat, denominador, n i IDs."
                : "Tria una consulta guiada: s'executen les mateixes eines analítiques i el resultat es mostra amb plantilles."}
            </p>
            {!aiConfigured ? (
              <div className="rise mt-4 w-full rounded-2xl border border-warn/25 bg-warn-tint px-4 py-3 text-left text-[12.5px] leading-relaxed text-ink" style={{ animationDelay: "150ms" }}>
                <strong>Mode demostració sense model connectat.</strong> No hi ha cap model de llenguatge configurat al servidor (ANTHROPIC_API_KEY). No se simula cap resposta d&apos;un model.
              </div>
            ) : null}
            <p className="rise mt-6 self-start text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle" style={{ animationDelay: "180ms" }}>
              Preguntes suggerides
            </p>
            <div className={"stagger mt-2 grid w-full gap-2 text-left sm:grid-cols-2"}>
              {SUGGESTED.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    disabled={busy}
                    onClick={() => ask(s)}
                    className="lift press group flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-g-300 disabled:opacity-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-g-50 text-g-700 transition-colors duration-200 group-hover:bg-brand-gradient group-hover:text-white dark:text-[var(--focus)]">
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-snug text-ink">{s.label}</span>
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{s.tag}</span>
                    </span>
                    <ArrowUpRight size={16} aria-hidden className="mt-0.5 shrink-0 -translate-x-1 text-g-600 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="msg-in-right ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-[var(--brand-glow)]">
                {t.text}
              </div>
            ) : (
              <div key={i} className="msg-in flex gap-3">
                <div className="pt-0.5">
                  <AiOrb size={30} busy={!t.done} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
                    <span className="font-semibold text-ink">Assistent</span>
                    {t.mode === "guided" ? <span className="rounded-full bg-surface-2 px-2 py-0.5 ring-1 ring-line">Consulta guiada (determinista)</span> : t.model ? <span className="rounded-full bg-surface-2 px-2 py-0.5 ring-1 ring-line">Model: {t.model}</span> : null}
                    {t.usage ? <span className="rounded-full bg-surface-2 px-2 py-0.5 ring-1 ring-line">{t.usage.rounds} rondes · {Math.round((t.usage.inputTokens + t.usage.outputTokens) / 1000)}k tokens</span> : null}
                  </div>
                  {t.tools.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                        Eines consultades · {t.tools.filter((r) => r.ok !== undefined).length}/{t.tools.length}
                      </p>
                      <ol className="flex flex-col">
                        {t.tools.map((r, j) => (
                          <ToolStep key={r.id} run={r} filters={filters} last={j === t.tools.length - 1} />
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {t.text || !t.done ? (
                    <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-[13.5px] text-ink shadow-[var(--shadow-card)]">
                      {t.text ? (
                        <>
                          <Markdown text={t.text} />
                          {!t.done ? <span aria-hidden className="stream-caret" /> : null}
                        </>
                      ) : (
                        <Thinking tools={t.tools} />
                      )}
                    </div>
                  ) : null}
                  {t.error ? (
                    <p className="animate-in flex items-center gap-1.5 rounded-xl bg-danger-tint px-3 py-2 text-[13px] text-danger">
                      <AlertTriangle size={14} aria-hidden /> {t.error}
                    </p>
                  ) : null}
                  {t.done && t.text ? (
                    <div className="animate-in flex flex-wrap items-center gap-1">
                      <AddToReportButton
                        item={{
                          kind: "assistant",
                          title: (turns[i - 1]?.text ?? "Resposta de l'assistent").slice(0, 200),
                          text: t.text.slice(0, 8000),
                          sampleIds: [...new Set(t.tools.flatMap((r) => r.output?.evidence.sampleIds ?? []))].slice(0, 200),
                          filters: filters as never,
                          evidence: t.tools.filter((r) => r.output).slice(0, 20).map((r) => ({ tool: r.name, summary: `${r.output!.evidence.unit}; ${r.output!.evidence.denominator}${r.output!.evidence.scopeChange ? `; ${r.output!.evidence.scopeChange}` : ""}`, n: r.output!.evidence.n, period: r.output!.evidence.period, dataset: r.output!.evidence.dataset })),
                        }}
                      />
                      <CopyButton text={t.text} />
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <div className="mx-auto max-w-3xl">
          {turns.length > 0 && !aiConfigured ? (
            <div className="chip-scroller -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {SUGGESTED.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    disabled={busy}
                    onClick={() => send({ guided: s.id, label: s.label })}
                    title={s.label}
                    className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-muted hover:border-g-300 hover:bg-g-50 hover:text-ink disabled:opacity-50"
                  >
                    <Icon size={13} className="text-g-600 dark:text-[var(--focus)]" aria-hidden />
                    {s.label.length > 44 ? `${s.label.slice(0, 42)}…` : s.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className={cn("composer flex items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 shadow-[var(--shadow-card)]", (!aiConfigured || busy) && "bg-surface-2")}>
            <textarea
              ref={textarea}
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[13.5px] leading-snug text-ink outline-none placeholder:text-subtle focus-visible:outline-none"
              placeholder={aiConfigured ? "Pregunta sobre les dades de l'àmbit actual…" : "Sense model connectat: tria una consulta guiada"}
              value={input}
              disabled={!aiConfigured || busy}
              rows={1}
              maxLength={2000}
              aria-label="Pregunta"
              onChange={(e) => {
                setInput(e.target.value);
                resize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {busy ? (
              <button onClick={() => abort.current?.abort()} aria-label="Aturar" className="press relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-surface">
                <span aria-hidden className="absolute inset-0 animate-ping rounded-xl bg-ink/20" />
                <Square size={13} fill="currentColor" aria-hidden />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!aiConfigured || !input.trim()}
                aria-label="Enviar"
                className="press sheen grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-[var(--brand-glow)] disabled:bg-none disabled:bg-line disabled:text-subtle disabled:shadow-none"
              >
                <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-center text-[11px] text-subtle">
            {aiConfigured ? "Enter per enviar · Maj+Enter per a una línia nova · " : ""}Verifica cada xifra amb les evidències abans d&apos;actuar.
          </p>
        </div>
      </div>
    </div>
  );
}
