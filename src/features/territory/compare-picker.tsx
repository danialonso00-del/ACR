"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/primitives";

/** Edits ?cmpType=circuit|comarca&cmp=a~b~c (2–4 entities) and ?stable=1. */
export function ComparePicker({ circuits, comarques }: { circuits: ComboOption[]; comarques: ComboOption[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const type = sp.get("cmpType") === "comarca" ? "comarca" : "circuit";
  const selected = (sp.get("cmp") ?? "").split("~").filter(Boolean);
  const options = type === "circuit" ? circuits : comarques;
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`${pathname}?${next.toString()}#comparacio`, { scroll: false }));
  };
  return (
    <div className={`flex flex-col gap-3 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Tipus de comparació" className="flex rounded-lg border border-line p-0.5">
          {(["circuit", "comarca"] as const).map((t) => (
            <button key={t} role="radio" aria-checked={type === t} onClick={() => set({ cmpType: t === "circuit" ? null : t, cmp: null })} className={`h-8 rounded-md px-3 text-[13px] font-medium ${type === t ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}>
              {t === "circuit" ? "Circuits" : "Comarques"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" className="accent-[var(--arc-green-dark)]" checked={sp.get("stable") === "1"} onChange={(e) => set({ stable: e.target.checked ? "1" : null })} />
          Cohort estable de circuits
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((key) => (
          <Badge key={key} tone="neutral" className="h-7 gap-1.5 pl-2.5 pr-1 text-[12.5px]">
            {options.find((o) => o.value === key)?.label ?? key}
            <button aria-label="Treure" className="rounded p-0.5 hover:bg-line" onClick={() => set({ cmp: selected.filter((k) => k !== key).join("~") || null })}>
              <X size={12} />
            </button>
          </Badge>
        ))}
        {selected.length < 4 ? (
          <Combobox
            className="w-full sm:w-80"
            label={type === "circuit" ? "Afegir circuit" : "Afegir comarca"}
            options={options.filter((o) => !selected.includes(o.value))}
            value={undefined}
            onChange={(v) => v && set({ cmp: [...selected, v].join("~") })}
            placeholder={type === "circuit" ? "Afegir circuit (2–4)…" : "Afegir comarca (2–4)…"}
            emptyLabel="—"
          />
        ) : null}
      </div>
    </div>
  );
}
