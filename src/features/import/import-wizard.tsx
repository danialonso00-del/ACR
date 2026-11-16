"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button, Field, inputClass, Note, selectClass } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

interface Preview {
  uploadId: string;
  fileName: string;
  format: string;
  sha256: string;
  headers: string[];
  rowCount: number;
  sample: string[][];
  suggested: Record<string, number>;
}

export function ImportWizard({ fields }: { fields: { key: string; label: string; required?: boolean }[] }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ importId: string; records: number; rejected: number; issues: number; rejectedSample: { line: number; reason: string }[] } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setPreview(body);
      setMapping(body.suggested);
      setLabel(body.fileName);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: preview.uploadId, mapping, label }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const missing = fields.filter((f) => f.required && mapping[f.key] === undefined);
  const core = ["sampleKg", "kg.total", "kg.perdues", "titular", "municipalitiesRaw"];
  const visibleFields = showAll ? fields : fields.filter((f) => f.required || mapping[f.key] !== undefined || core.includes(f.key));

  return (
    <div className="flex flex-col gap-4">
      <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-4 py-6 text-center hover:bg-surface-2", busy && "opacity-60")}>
        {busy ? <Loader2 className="animate-spin text-muted" aria-hidden /> : <Upload className="text-muted" aria-hidden />}
        <span className="text-[13.5px] font-medium">Puja un fitxer CSV, XLSX o JSON (màx. 10 MB)</span>
        <span className="text-[12px] text-muted">Per exemple, l&apos;exportació oficial del SDR o un extracte autoritzat per l&apos;ARC</span>
        <input type="file" className="sr-only" accept=".csv,.txt,.xlsx,.json" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {error ? <Note tone="danger">{error}</Note> : null}
      {preview && !result ? (
        <>
          <p className="text-[13px] text-muted">
            <strong className="text-ink">{preview.fileName}</strong> · {preview.format.toUpperCase()} · {preview.rowCount} files · {preview.headers.length} columnes · sha256 {preview.sha256.slice(0, 12)}…
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="tabular w-full text-[11.5px]">
              <caption className="sr-only">Vista prèvia (10 primeres files)</caption>
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} scope="col" className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                      {i}: {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {preview.headers.map((_, j) => (
                      <td key={j} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1">
                        {r[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Mapatge de columnes</p>
            <button className="text-[12.5px] text-muted underline" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Mostrar només els principals" : `Mostrar tots els camps (${fields.length})`}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleFields.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                <select
                  className={selectClass}
                  value={mapping[f.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => {
                      const n = { ...m };
                      if (e.target.value === "") delete n[f.key];
                      else n[f.key] = Number(e.target.value);
                      return n;
                    })
                  }
                >
                  <option value="">— no mapejat —</option>
                  {preview.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {i}: {h}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Field label="Nom del conjunt importat">
            <input className={inputClass} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {missing.length ? <Note tone="warn">Falten camps obligatoris: {missing.map((m) => m.label).join(", ")}.</Note> : null}
          <Note tone="neutral">Les dades importades es validen amb les mateixes regles de qualitat i es mantenen separades (mode «Dades importades»). No es barregen amb l&apos;extracte públic.</Note>
          <Button variant="primary" className="self-start" disabled={busy || missing.length > 0} onClick={commit}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null} Importar {preview.rowCount} files
          </Button>
        </>
      ) : null}
      {result ? (
        <Note tone="info">
          <p className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 size={15} aria-hidden /> Importació completada: {result.records} registres ({result.rejected} rebutjats, {result.issues} avisos de qualitat).
          </p>
          {result.rejectedSample.length ? <p className="mt-1 text-muted">Rebutjats: {result.rejectedSample.map((r) => `línia ${r.line}: ${r.reason}`).join("; ")}</p> : null}
          <Link href={`/?mode=imported&importId=${result.importId}`} className="mt-2 inline-block font-medium underline">
            Obrir el conjunt importat →
          </Link>
        </Note>
      ) : null}
    </div>
  );
}
