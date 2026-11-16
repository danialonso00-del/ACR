"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/format";
import { useCarriedQuery } from "./sidebar";

const STEPS = [
  { key: "overview", href: "/", match: (p: string) => p === "/" },
  { key: "territory", href: "/territori", match: (p: string) => p.startsWith("/territori") },
  { key: "sample", href: "/caracteritzacions", match: (p: string) => p.startsWith("/caracteritzacions") },
  { key: "photos", href: "/arxiu-visual", match: (p: string) => p.startsWith("/arxiu-visual") },
  { key: "ai", href: "/assistent", match: (p: string) => p.startsWith("/assistent") },
  { key: "report", href: "/informes", match: (p: string) => p.startsWith("/informes") },
] as const;

/** The guided journey (summary → territory → sample → photos → AI → report); shown only on its own pages. */
export function JourneySteps({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();
  const q = useCarriedQuery();
  const current = STEPS.findIndex((s) => s.match(pathname));
  if (current < 0) return null;
  return (
    <nav aria-label={labels.label} className="no-print chip-scroller -mx-1 mb-4 overflow-x-auto px-1">
      <ol className="flex w-max items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={s.key} className="flex items-center gap-1">
              {i ? <span aria-hidden className={cn("h-px w-4 sm:w-6", done || here ? "bg-g-400" : "bg-line-strong")} /> : null}
              <Link
                href={`${s.href}${q}`}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "press inline-flex h-7 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[12px] font-medium",
                  here ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-g-200" : done ? "text-g-700 hover:bg-surface/70 dark:text-[var(--focus)]" : "text-subtle hover:bg-surface/70 hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold",
                    here ? "bg-brand-gradient text-white shadow-[var(--brand-glow)]" : done ? "bg-g-100 text-g-700 dark:text-[var(--focus)]" : "bg-surface-2 text-subtle ring-1 ring-line",
                  )}
                >
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                {labels[s.key]}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
