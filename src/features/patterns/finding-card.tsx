import { Card } from "@/components/ui/primitives";

export interface FindingMeta {
  question: string;
  period: string;
  cohort: string;
  n: string;
  method: string;
  magnitude: React.ReactNode;
  uncertainty: string;
  limitations: string;
  actions: string;
}

/** Standard structure for every analytical finding (brief §D). */
export function FindingCard({ id, title, meta, children, aside }: { id?: string; title: string; meta: FindingMeta; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-28 overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 border-line p-5 lg:border-r">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          <p className="mt-1 text-[13px] text-muted">{meta.question}</p>
          <div className="mt-3 text-[14px]">{meta.magnitude}</div>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        <aside className="bg-surface-2/50 p-5">
          <dl className="flex flex-col gap-2.5 text-[12.5px]">
            {(
              [
                ["Període", meta.period],
                ["Cohort", meta.cohort],
                ["Mida de mostra", meta.n],
                ["Mètode", meta.method],
                ["Incertesa", meta.uncertainty],
                ["Limitacions", meta.limitations],
                ["Accions per a revisió humana", meta.actions],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{k}</dt>
                <dd className="mt-0.5 leading-snug text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {aside}
        </aside>
      </div>
    </Card>
  );
}
