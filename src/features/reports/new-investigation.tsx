"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { Button, Field, inputClass, Note } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

export function NewInvestigation({ filters, scopeLabel, sources, analyses, synthetic }: { filters: Record<string, unknown>; scopeLabel: string; sources: { name: string; status: string }[]; analyses: string[]; synthetic: boolean }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, title: title || undefined, filters }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      router.push(`/informes/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <ol className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted" aria-label="Passos">
        {["Pregunta", "Abast i fonts", "Anàlisi", "Dossier"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", i < step ? "bg-brand-dark text-white" : "bg-surface-2 text-muted")}>{i + 1}</span>
            {s}
            {i < 3 ? <ArrowRight size={12} className="text-subtle" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <Field label="Pregunta de recerca">
        <textarea
          className={cn(inputClass, "h-24 resize-y py-2")}
          placeholder="Ex.: Quins circuits del Vallès Oriental han empitjorat en impropis l'últim any i quines fraccions ho expliquen?"
          value={question}
          maxLength={600}
          onChange={(e) => {
            setQuestion(e.target.value);
            setStep(1);
          }}
        />
      </Field>
      <Field label="Títol (opcional)">
        <input className={inputClass} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {step === 1 ? (
        <Button variant="primary" className="self-start" disabled={question.trim().length < 3} onClick={() => setStep(2)}>
          Proposar abast i fonts <ArrowRight size={15} aria-hidden />
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Note tone="neutral">
            <p className="font-medium">Abast proposat (filtres actuals)</p>
            <p>{scopeLabel}</p>
            {synthetic ? <p className="mt-1 font-medium text-warn">Atenció: mode de dades sintètiques.</p> : null}
            <p className="mt-2 font-medium">Fonts</p>
            <ul className="list-disc pl-5">
              {sources.map((s) => (
                <li key={s.name}>
                  {s.name} — {s.status}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-medium">Anàlisis que s&apos;executaran (en codi, sobre dades autoritzades)</p>
            <ul className="list-disc pl-5">
              {analyses.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted">Per canviar l&apos;abast, modifica els filtres de la barra superior. No s&apos;utilitza cerca web externa.</p>
          </Note>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button variant="primary" className="self-start" disabled={busy} onClick={run}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />} Executar l&apos;anàlisi i generar el dossier
          </Button>
        </div>
      )}
    </div>
  );
}
