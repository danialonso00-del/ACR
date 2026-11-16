"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Database, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Badge, Button, Field, selectClass } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/overlays";
import { cn } from "@/lib/format";

export interface FilterBarProps {
  values: Record<string, string | undefined>;
  months: string[];
  defaults: { from: string; to: string };
  comarques: ComboOption[];
  circuits: (ComboOption & { comarca: string | null })[];
  formTypes: string[];
  collectionTypes: string[];
  modes: { value: string; label: string; disabled?: boolean }[];
  imports: { value: string; label: string }[];
  status: { label: string; tone: "brand" | "synthetic" | "info"; detail: string };
  labels: Record<string, string>;
}

const SCOPE_KEYS = ["from", "to", "comarca", "circuit", "formType", "collectionType", "estimator", "lowMass", "minN"];

export function FilterBar(props: FilterBarProps) {
  const { values, labels } = props;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [drawer, setDrawer] = useState(false);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const q = next.toString();
    start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }));
  };
  const reset = () => update(Object.fromEntries(SCOPE_KEYS.map((k) => [k, undefined])));
  const lastMonth = props.months.at(-1) ?? props.defaults.to;
  const preset = (months: number | "all") => {
    if (months === "all") return update({ from: props.months[0], to: lastMonth });
    const idx = Math.max(0, props.months.length - months);
    update({ from: props.months[idx], to: lastMonth });
  };
  const circuitOptions = values.comarca ? props.circuits.filter((c) => c.comarca === values.comarca) : props.circuits;
  const years = [...new Set(props.months.map((m) => m.slice(0, 4)))];
  const monthSelect = (key: "from" | "to", label: string) => (
    <Field label={label}>
      <select className={selectClass} value={values[key] ?? props.defaults[key]} onChange={(e) => update({ [key]: e.target.value })} aria-label={label}>
        {years.map((y) => (
          <optgroup key={y} label={y}>
            {props.months
              .filter((m) => m.startsWith(y))
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );

  const primary = (
    <>
      <div className="grid grid-cols-2 gap-2">
        {monthSelect("from", labels.from!)}
        {monthSelect("to", labels.to!)}
      </div>
      <Field label={labels.territory!}>
        <Combobox
          label={labels.territory!}
          options={props.comarques}
          value={values.comarca}
          onChange={(v) => update({ comarca: v, circuit: undefined })}
          placeholder={labels.allTerritory!}
          emptyLabel={labels.allTerritory!}
        />
      </Field>
      <Field label={labels.circuit!}>
        <Combobox label={labels.circuit!} options={circuitOptions} value={values.circuit} onChange={(v) => update({ circuit: v })} placeholder={labels.allCircuits!} emptyLabel={labels.allCircuits!} />
      </Field>
      <Field label={labels.stream!}>
        <select className={selectClass} value={values.stream ?? "FORM"} onChange={(e) => update({ stream: e.target.value === "FORM" ? undefined : e.target.value })} aria-label={labels.stream}>
          <option value="FORM">FORM</option>
          <option value="RESTA" disabled>
            RESTA · {labels.streamUnavailable}
          </option>
          <option value="REBUIG" disabled>
            REBUIG · {labels.streamUnavailable}
          </option>
        </select>
      </Field>
    </>
  );

  const secondary = (
    <>
      <Field label={labels.mode!}>
        <select
          className={selectClass}
          value={values.mode ?? "public_snapshot"}
          onChange={(e) => update({ mode: e.target.value === "public_snapshot" ? undefined : e.target.value, importId: undefined, comarca: undefined, circuit: undefined, from: undefined, to: undefined })}
          aria-label={labels.mode}
        >
          {props.modes.map((m) => (
            <option key={m.value} value={m.value} disabled={m.disabled}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      {values.mode === "imported" && props.imports.length > 1 ? (
        <Field label="Importació">
          <select className={selectClass} value={values.importId ?? props.imports[0]?.value} onChange={(e) => update({ importId: e.target.value })}>
            {props.imports.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label={labels.estimator!}>
        <select className={selectClass} value={values.estimator ?? "mean_sample"} onChange={(e) => update({ estimator: e.target.value === "mean_sample" ? undefined : e.target.value })}>
          <option value="mean_sample">{labels.est_mean_sample}</option>
          <option value="mass_ratio">{labels.est_mass_ratio}</option>
        </select>
      </Field>
      <Field label={labels.formType!}>
        <select className={selectClass} value={values.formType ?? ""} onChange={(e) => update({ formType: e.target.value || undefined })}>
          <option value="">{labels.any}</option>
          {props.formTypes.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </Field>
      <Field label={labels.collectionType!}>
        <select className={selectClass} value={values.collectionType ?? ""} onChange={(e) => update({ collectionType: e.target.value || undefined })}>
          <option value="">{labels.any}</option>
          {props.collectionTypes.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </Field>
      <Field label={labels.lowMass!}>
        <select className={selectClass} value={values.lowMass ?? "exclude"} onChange={(e) => update({ lowMass: e.target.value === "exclude" ? undefined : e.target.value })}>
          <option value="exclude">{labels.exclude}</option>
          <option value="include">{labels.include}</option>
        </select>
      </Field>
      <Field label={labels.minN!}>
        <select className={selectClass} value={values.minN ?? "5"} onChange={(e) => update({ minN: e.target.value === "5" ? undefined : e.target.value })}>
          {[3, 5, 8, 10, 15, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
    </>
  );

  const curFrom = values.from ?? props.defaults.from;
  const curTo = values.to ?? props.defaults.to;
  const presetActive = (months: number | "all") =>
    curTo === lastMonth && curFrom === (months === "all" ? props.months[0] : props.months[Math.max(0, props.months.length - months)]);
  const presetOptions: [number | "all", string][] = [
    [12, "12 m"],
    [24, "24 m"],
    [36, "36 m"],
    ["all", labels.allLoaded!],
  ];
  const presets = (
    <div role="group" aria-label={labels.period ?? "Període"} className="inline-flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5 ring-1 ring-line">
      {presetOptions.map(([m, l]) => {
        const on = presetActive(m);
        return (
          <button
            key={String(m)}
            onClick={() => preset(m)}
            aria-pressed={on}
            className={cn(
              "press h-7 rounded-[10px] px-2.5 text-[12px] font-semibold",
              on ? "bg-brand-gradient text-white shadow-[var(--brand-glow)]" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );

  // Count only what the user set in the URL (defaults such as the default period are not "active").
  const activeCount = SCOPE_KEYS.filter((k) => sp.get(k)).length;

  return (
    <div className="no-print sticky top-0 z-20 px-3 pt-3 sm:px-6 lg:px-8 max-lg:top-14">
      <div className="glass mx-auto flex max-w-[1440px] flex-col gap-2.5 rounded-2xl border border-line px-3 py-2.5 shadow-[var(--shadow-card)] sm:px-4 sm:py-3">
        <div className="hidden items-end gap-3 xl:flex">
          <div className="grid flex-1 grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(200px,1.3fr)_110px] items-end gap-3">{primary}</div>
          <Button variant="ghost" size="sm" onClick={() => setDrawer(true)} aria-label={labels.more}>
            <SlidersHorizontal size={15} aria-hidden /> {labels.more}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} disabled={activeCount === 0}>
            <RotateCcw size={14} aria-hidden /> {labels.reset}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 xl:hidden">
          <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
            <SlidersHorizontal size={15} aria-hidden /> {labels.title}
            {activeCount ? <span className="check-pop ml-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[11px] font-semibold text-white">{activeCount}</span> : null}
          </Button>
          <StatusBadge {...props.status} />
        </div>
        <div className="hidden flex-wrap items-center justify-between gap-2 xl:flex">
          {presets}
          <div className="flex items-center gap-2">
            {pending ? (
              <span className="flex items-center gap-1 text-[12px] text-muted" role="status">
                <Loader2 size={13} className="animate-spin" aria-hidden /> {labels.applying}
              </span>
            ) : null}
            <StatusBadge {...props.status} />
          </div>
        </div>
      </div>
      <Sheet open={drawer} onOpenChange={setDrawer} title={labels.title!} description={props.status.detail}>
        <div className={cn("flex flex-col gap-3 p-4", pending && "opacity-70")}>
          <div className="xl:hidden">{presets}</div>
          <div className="flex flex-col gap-3 xl:hidden">{primary}</div>
          {secondary}
          <Button variant="secondary" onClick={reset} disabled={activeCount === 0}>
            <RotateCcw size={14} aria-hidden /> {labels.reset}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function StatusBadge({ label, tone, detail }: FilterBarProps["status"]) {
  const sp = useSearchParams();
  const q = sp.toString();
  return (
    <Link href={`/fonts${q ? `?${q}` : ""}`} title={detail} className="rounded-full focus-visible:outline-2">
      <Badge tone={tone} className="h-7 px-2.5 transition-shadow hover:shadow-[var(--shadow-card)]">
        {tone === "brand" ? <span aria-hidden className="live-dot !h-1.5 !w-1.5 text-g-500" /> : <Database size={12} aria-hidden />}
        <span>{label}</span>
        <span className="hidden font-normal opacity-80 sm:inline">· {detail}</span>
      </Badge>
    </Link>
  );
}
