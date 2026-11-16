/** Locale-aware formatting (Catalan by default, Europe/Madrid calendar dates). */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { INTL_LOCALE, TIME_ZONE, type Locale } from "@/i18n/messages";

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: Locale, digits: number) {
  const key = `${locale}:${digits}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(key, f);
  }
  return f;
}

/** Rounds first so that tiny negatives never print as "-0,00". */
const clean = (v: number, digits: number) => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Object.is(r, -0) ? 0 : r;
};

export const fmtNum = (v: number | null | undefined, digits = 0, locale: Locale = "ca") =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : nf(locale, digits).format(clean(v, digits));

export const fmtPct = (v: number | null | undefined, digits = 1, locale: Locale = "ca") =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${nf(locale, digits).format(v)} %`;

export const fmtPp = (v: number | null | undefined, digits = 1, locale: Locale = "ca") =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${nf(locale, digits).format(Math.abs(v))} pp`;

/** ISO calendar date "2026-10-30" → "30/10/2026" (no time-zone shift: it is a local calendar date). */
export function fmtDate(iso: string | null | undefined, locale: Locale = "ca"): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return locale === "en" ? `${d}/${m}/${y}` : `${d}/${m}/${y}`;
}

/** Instant (capture timestamps) shown in Europe/Madrid. */
export function fmtInstant(iso: string | null | undefined, locale: Locale = "ca"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const MONTHS_CA = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];
export function fmtMonth(ym: string, locale: Locale = "ca"): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  if (locale === "ca") return `${MONTHS_CA[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function cn(...parts: ClassValue[]) {
  return twMerge(clsx(parts));
}
