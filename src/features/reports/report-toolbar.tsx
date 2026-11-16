"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileDown, Loader2, Pencil, Save } from "lucide-react";
import { Button, inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { exportReportPdf } from "./pdf";
import type { Report } from "./types";

export function ReportToolbar({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const pdf = async () => {
    setBusy(true);
    try {
      const r = (await (await fetch(`/api/reports/${id}`)).json()) as Report;
      await exportReportPdf(r);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="primary" size="sm" onClick={pdf} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FileDown size={15} aria-hidden />} Exportar PDF
      </Button>
      <a href={`/api/reports/${id}/csv`} className="press inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium hover:border-g-300 hover:bg-g-50" download>
        <Download size={15} aria-hidden /> CSV de mostres
      </a>
    </>
  );
}

export function SummaryEditor({ id, initial }: { id: string; initial: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: text }) });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };
  if (!editing)
    return (
      <div className="group relative">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{initial || "—"}</p>
        <button onClick={() => setEditing(true)} className="no-print mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
          <Pencil size={13} aria-hidden /> Editar resum
        </button>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <textarea className={cn(inputClass, "h-40 resize-y py-2 leading-relaxed")} value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} aria-label="Resum executiu" />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={save} disabled={saving}>
          <Save size={14} aria-hidden /> Desar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setText(initial); setEditing(false); }}>
          Cancel·lar
        </Button>
      </div>
      <p className="text-[11.5px] text-subtle">Les xifres del resum provenen de l&apos;anàlisi; si les edites, revisa que continuïn reconciliant amb les taules.</p>
    </div>
  );
}
