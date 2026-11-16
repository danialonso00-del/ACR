"use client";
import Link from "next/link";
import { Fragment } from "react";
import { ClipboardCheck, Database, Lightbulb, ListChecks, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Tiny, safe markdown renderer for assistant text: paragraphs, bullet lists,
 * **bold**, _italic_, `code` and links. No raw HTML is ever rendered; links
 * are limited to relative paths and https URLs. A line that starts with a bold
 * section name (Dada observada, Hipòtesi, Recomanació…) becomes a section label.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("_")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded-md bg-g-50 px-1.5 py-px text-[12px] text-g-800 dark:text-[var(--focus)]">{tok.slice(1, -1)}</code>);
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = lm[2]!;
      const cls = "font-medium text-g-700 underline decoration-g-300 underline-offset-2 transition-colors hover:decoration-g-600 dark:text-[var(--focus)]";
      if (href.startsWith("/")) out.push(<Link key={k} href={href} className={cls}>{lm[1]}</Link>);
      else if (/^https:\/\//.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noreferrer noopener" className={cls}>{lm[1]}</a>);
      else out.push(lm[1]);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const SECTIONS: { re: RegExp; icon: typeof Database; cls: string }[] = [
  { re: /^dada observada|^datos? observados?|^observed data/i, icon: Database, cls: "bg-g-100 text-g-800 dark:text-[var(--focus)]" },
  { re: /^hip[oò]tesi|^hypothes/i, icon: Lightbulb, cls: "bg-warn-tint text-warn" },
  { re: /^recomanaci|^recomendaci|^recommend/i, icon: ListChecks, cls: "bg-info-tint text-info" },
  { re: /^limitaci|^limitation/i, icon: ShieldAlert, cls: "bg-surface-2 text-muted ring-1 ring-line" },
  { re: /^troballes|^hallazgos|^findings/i, icon: ClipboardCheck, cls: "bg-g-100 text-g-800 dark:text-[var(--focus)]" },
];

function sectionOf(line: string) {
  const m = line.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
  if (!m) return null;
  const name = m[1]!.replace(/[.:]$/, "").trim();
  const s = SECTIONS.find((x) => x.re.test(name));
  return s ? { ...s, name, rest: m[2]!.replace(/^[—–:-]\s*/, "") } : null;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: { depth: number; text: string }[] = [];
  const flushList = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} className="my-1.5 flex flex-col gap-1 pl-5">
        {list.map((li, j) => (
          <li key={j} className={cn("leading-relaxed marker:text-g-500", li.depth ? "ml-4 list-[circle]" : "list-disc")}>
            {inline(li.text, `${key}-${j}`)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((line, idx) => {
    const lm = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (lm) {
      list.push({ depth: lm[1]!.length >= 2 ? 1 : 0, text: lm[2]! });
      return;
    }
    flushList(`l${idx}`);
    if (!line.trim()) return;
    const sec = sectionOf(line);
    if (sec) {
      const Icon = sec.icon;
      blocks.push(
        <div key={idx} className={cn("mt-3 flex flex-wrap items-center gap-2 first:mt-0")}>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", sec.cls)}>
            <Icon size={12} aria-hidden />
            {sec.name}
          </span>
          {sec.rest ? <span className="text-[12.5px] text-muted">{inline(sec.rest, `s${idx}`)}</span> : null}
        </div>,
      );
      return;
    }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<p key={idx} className="mt-3 font-semibold text-ink">{inline(h[1]!, `h${idx}`)}</p>);
    else blocks.push(<p key={idx} className="my-1.5 leading-relaxed">{inline(line, `p${idx}`)}</p>);
  });
  flushList("end");
  return <Fragment>{blocks}</Fragment>;
}
