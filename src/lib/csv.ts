/** CSV writer with formula-injection protection (cells starting with = + - @ tab CR are prefixed with '). */
export type CsvCell = string | number | boolean | null | undefined;

export function csvEscape(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon-separated (Excel in ca/es locales), UTF-8 with BOM, metadata lines prefixed with '#'. */
export function toCsv(header: string[], rows: CsvCell[][], meta: string[] = []): string {
  const lines = [...meta.map((m) => `# ${m.replace(/[\r\n]+/g, " ")}`), header.map(csvEscape).join(";"), ...rows.map((r) => r.map(csvEscape).join(";"))];
  return "﻿" + lines.join("\r\n");
}
