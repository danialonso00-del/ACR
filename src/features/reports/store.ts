import "server-only";
/** File-based report store for the local demo (data/runtime/reports). Replace with PostgreSQL in production. */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RUNTIME_DIR } from "@/lib/data/repository";
import type { Report, ReportItem, ReportItemInput } from "./types";

const DIR = path.join(RUNTIME_DIR, "reports");
const ID_RE = /^r-\d{8}-[a-f0-9]{6}$/;
const MAX_ITEMS = 100;

export const isReportId = (id: string) => ID_RE.test(id);

export function newReportId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `r-${d}-${randomBytes(3).toString("hex")}`;
}

export function saveReport(r: Report) {
  mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${r.id}.json`);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(r, null, 1));
  renameSync(tmp, file); // atomic replace
}

export function getReport(id: string): Report | null {
  if (!isReportId(id)) return null;
  const file = path.join(DIR, `${id}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Report) : null;
}

export type ReportSummary = Pick<Report, "id" | "title" | "question" | "updatedAt" | "createdAt" | "mode" | "scopeLabel"> & { items: number; findings: number };

export function listReports(): ReportSummary[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && isReportId(f.replace(/\.json$/, "")))
    .map((f) => {
      const r = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Report;
      return { id: r.id, title: r.title, question: r.question, updatedAt: r.updatedAt, createdAt: r.createdAt, mode: r.mode, scopeLabel: r.scopeLabel, items: r.items.length, findings: r.findings.length };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addItem(id: string, input: ReportItemInput): Report | null {
  const r = getReport(id);
  if (!r) return null;
  if (r.items.length >= MAX_ITEMS) throw new Error(`Report item limit (${MAX_ITEMS}) reached`);
  const item: ReportItem = { ...input, id: randomBytes(4).toString("hex"), addedAt: new Date().toISOString() };
  r.items.push(item);
  r.updatedAt = item.addedAt;
  saveReport(r);
  return r;
}
