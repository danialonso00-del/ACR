"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, FilePlus2, Loader2 } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/primitives";
import type { ReportItemInput } from "./types";

type Summary = { id: string; title: string; updatedAt: string; items: number };

/** Appends an item (sample, assistant answer, finding) to an existing or new report. */
export function AddToReportButton({ item, size = "sm", label = "Afegir a informe" }: { item: ReportItemInput; size?: "sm" | "md"; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<Summary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setDone(null);
    setError(null);
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports))
      .catch(() => setError("No s'han pogut carregar els informes"));
  };
  const add = async (id: string, title: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      if (!res.ok) throw new Error((await res.json()).error);
      setDone({ id, title });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const createAndAdd = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: item.title, title: `Recull: ${item.title}`.slice(0, 160), filters: item.filters ?? {}, empty: true }) });
      const { id } = await res.json();
      await add(id, `Recull: ${item.title}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <Popover.Trigger asChild>
        <Button variant="secondary" size={size}>
          <FilePlus2 size={15} aria-hidden /> {label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="end" collisionPadding={12} className="dialog-content z-50 w-[300px] rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
          {done ? (
            <div className="flex flex-col gap-2 p-2 text-[13px]">
              <p className="flex items-center gap-1.5 font-medium text-brand-dark dark:text-[var(--focus)]"><Check size={15} aria-hidden /> Afegit a «{done.title}»</p>
              <Link href={`/informes/${done.id}`} className="text-brand-dark underline-offset-2 hover:underline dark:text-[var(--focus)]">Obrir l&apos;informe →</Link>
            </div>
          ) : (
            <>
              <p className="px-2 pb-1 pt-1 text-[12px] font-semibold uppercase tracking-wide text-subtle">Afegir a…</p>
              {error ? <p className="px-2 py-1 text-[12.5px] text-danger">{error}</p> : null}
              {!reports ? <p className="flex items-center gap-1.5 px-2 py-2 text-[13px] text-muted"><Loader2 size={14} className="animate-spin" /> Carregant…</p> : null}
              <ul className="max-h-56 overflow-auto">
                {reports?.map((r) => (
                  <li key={r.id}>
                    <button disabled={busy} onClick={() => add(r.id, r.title)} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:opacity-50">
                      <span className="block truncate">{r.title}</span>
                      <span className="text-[11.5px] text-subtle">{r.items} elements · {r.updatedAt.slice(0, 10)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button disabled={busy} onClick={createAndAdd} className="mt-1 w-full rounded-md border-t border-line px-2 py-2 text-left text-[13px] font-medium text-brand-dark hover:bg-surface-2 disabled:opacity-50 dark:text-[var(--focus)]">
                + Nou informe amb aquest element
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
