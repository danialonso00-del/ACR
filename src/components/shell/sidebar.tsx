"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Database,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Moon,
  Sparkles,
  Sun,
  TableProperties,
} from "lucide-react";
import { cn } from "@/lib/format";
import { Sheet } from "@/components/ui/overlays";
import type { Locale } from "@/i18n/messages";

export interface NavLabels {
  items: { href: string; label: string; icon: keyof typeof ICONS; group: "explore" | "ai" | "data" }[];
  groups: Record<"explore" | "ai" | "data", string>;
  promo: { title: string; text: string; cta: string };
  appName: string;
  demo: string;
  demoNote: string;
  menu: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
}

const ICONS = {
  overview: LayoutDashboard,
  territory: MapIcon,
  samples: TableProperties,
  patterns: BarChart3,
  archive: Camera,
  assistant: Sparkles,
  reports: FileText,
  sources: Database,
};

/** Filter keys that travel between sections. */
const CARRY = ["mode", "importId", "from", "to", "comarca", "circuit", "stream", "formType", "collectionType", "estimator", "lowMass", "minN"];

export function useCarriedQuery() {
  const sp = useSearchParams();
  const carried = new URLSearchParams();
  for (const k of CARRY) {
    const v = sp.get(k);
    if (v) carried.set(k, v);
  }
  const q = carried.toString();
  return q ? `?${q}` : "";
}

function NavList({ labels, onNavigate }: { labels: NavLabels; onNavigate?: () => void }) {
  const pathname = usePathname();
  const q = useCarriedQuery();
  const groups = (["explore", "ai", "data"] as const).map((g) => ({ g, items: labels.items.filter((i) => i.group === g) }));
  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ g, items }) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">{labels.groups[g]}</p>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const ai = item.icon === "assistant";
              return (
                <li key={item.href}>
                  <Link
                    href={`${item.href}${q}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press group relative flex h-10 items-center gap-2.5 rounded-xl px-1.5 text-[13.5px] font-medium",
                      active ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line dark:bg-surface-2" : "text-muted hover:bg-g-50 hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-[background-color,color,transform,box-shadow] duration-200 group-hover:scale-105",
                        active || ai ? "bg-brand-gradient text-white shadow-[var(--brand-glow)]" : "bg-g-50 text-g-700 group-hover:bg-g-100 dark:text-[var(--focus)]",
                      )}
                    >
                      <Icon size={15} strokeWidth={active ? 2.3 : 2} aria-hidden />
                    </span>
                    <span className="truncate">{item.label}</span>
                    {active ? <span aria-hidden className="ml-auto mr-1.5 h-1.5 w-1.5 rounded-full bg-g-500 check-pop" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <div aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-gradient text-[12.5px] font-extrabold tracking-tight text-white shadow-[var(--brand-glow)]">
        <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-lime/60 blur-[6px]" />
        <span className="relative">ARC</span>
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-ink">Intel·ligència de Residus</p>
        <p className="truncate text-[11.5px] text-subtle">Dades públiques ARC · demo MTI</p>
      </div>
    </div>
  );
}

function AssistantPromo({ labels, onNavigate }: { labels: NavLabels; onNavigate?: () => void }) {
  const q = useCarriedQuery();
  const pathname = usePathname();
  if (pathname.startsWith("/assistent")) return null;
  return (
    <Link
      href={`/assistent${q}`}
      onClick={onNavigate}
      className="lift group relative block overflow-hidden rounded-2xl bg-brand-gradient p-3.5 text-white shadow-[var(--brand-glow)]"
    >
      <span aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-lime/40 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <span aria-hidden className="absolute -bottom-10 -left-4 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
      <span className="relative flex items-center gap-2">
        <span aria-hidden className="ai-orb h-6 w-6 ring-2 ring-white/40">
          <span className="ai-orb-core" />
        </span>
        <span className="text-[13px] font-semibold">{labels.promo.title}</span>
      </span>
      <span className="relative mt-1.5 block text-[12px] leading-snug text-white/85">{labels.promo.text}</span>
      <span className="relative mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold">
        {labels.promo.cta} <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function persistLocale(l: Locale) {
  document.cookie = `arc_locale=${l}; path=/; max-age=31536000; samesite=lax`;
}

function Preferences({ labels, locale }: { labels: NavLabels; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const setLocale = (l: Locale) => {
    persistLocale(l);
    start(() => router.refresh());
  };
  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("arc_theme", next);
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
    window.dispatchEvent(new Event("arc-theme"));
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <div role="group" aria-label={labels.language} className={cn("flex rounded-xl bg-surface-2 p-0.5 ring-1 ring-line", pending && "opacity-60")}>
        {(["ca", "es", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={cn("press h-7 rounded-[10px] px-2.5 text-[11.5px] font-semibold uppercase", locale === l ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-subtle hover:text-ink")}
          >
            {l}
          </button>
        ))}
      </div>
      <button onClick={toggleTheme} className="press grid h-8 w-8 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line hover:text-ink" aria-label={`${labels.theme}: ${labels.light} / ${labels.dark}`}>
        <Sun size={15} className="dark:hidden" aria-hidden />
        <Moon size={15} className="hidden dark:block" aria-hidden />
      </button>
    </div>
  );
}

export function Sidebar({ labels, locale }: { labels: NavLabels; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[244px] flex-col rounded-3xl border border-line shadow-[var(--shadow-card)] lg:flex">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <nav aria-label="Seccions" className="flex-1 overflow-y-auto px-2.5 py-3">
          <NavList labels={labels} />
        </nav>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <AssistantPromo labels={labels} />
          <Preferences labels={labels} locale={locale} />
          <p className="flex items-start gap-1.5 px-1 text-[10.5px] leading-snug text-subtle" title={labels.demoNote}>
            <span>
              {labels.demo}
              <span className="block">{labels.demoNote}</span>
            </span>
          </p>
        </div>
      </aside>
      <div className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="press grid h-9 w-9 place-items-center rounded-xl bg-surface text-ink ring-1 ring-line" aria-label={labels.menu}>
          <Menu size={18} aria-hidden />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title={labels.appName} side="left">
        <nav aria-label="Seccions" className="px-3 py-4">
          <NavList labels={labels} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
          <AssistantPromo labels={labels} onNavigate={() => setOpen(false)} />
          <Preferences labels={labels} locale={locale} />
          <p className="text-[11px] text-subtle">{labels.demo} · {labels.demoNote}</p>
        </div>
      </Sheet>
    </>
  );
}
