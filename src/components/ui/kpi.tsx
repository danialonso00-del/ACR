import { Info } from "lucide-react";
import { Card } from "./primitives";
import { InfoPopover } from "./overlays";
import { cn } from "@/lib/format";

export function KpiTile({ label, value, unit, denominator, methodology, delta, className }: { label: string; value: string; unit?: string; denominator: React.ReactNode; methodology: React.ReactNode; delta?: { text: string; tone: "up" | "down" | "flat"; note?: string }; className?: string }) {
  return (
    <Card className={cn("lift group relative flex min-w-0 flex-col gap-1.5 overflow-hidden px-4 py-4", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-g-100/70 blur-2xl transition-transform duration-500 group-hover:scale-125 dark:bg-g-200/40" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium leading-snug text-muted">{label}</p>
        <InfoPopover
          label={`Metodologia · ${label}`}
          trigger={
            <button className="press -mr-1.5 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-subtle hover:bg-g-50 hover:text-g-700" aria-label={`Metodologia: ${label}`}>
              <Info size={15} aria-hidden />
            </button>
          }
        >
          {methodology}
        </InfoPopover>
      </div>
      <p className="relative flex items-baseline gap-1">
        <span className="tabular text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">{value}</span>
        {unit ? <span className="text-[14px] font-medium text-muted">{unit}</span> : null}
      </p>
      {delta ? (
        <p className={cn("relative text-[12px] font-medium", delta.tone === "up" ? "text-danger" : delta.tone === "down" ? "text-info" : "text-muted")}>
          <span aria-hidden>{delta.tone === "up" ? "▲ " : delta.tone === "down" ? "▼ " : "■ "}</span>
          {delta.text}
          {delta.note ? <span className="font-normal text-muted"> · {delta.note}</span> : null}
        </p>
      ) : null}
      <p className="relative mt-auto text-[11.5px] leading-snug text-subtle">{denominator}</p>
    </Card>
  );
}
