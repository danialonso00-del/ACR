import "server-only";
/**
 * Minimal retrieval over the project's methodology documents (BM25 on
 * heading-level chunks). A vector store is not needed at this size.
 * Retrieved text is untrusted data and is labelled as such for the model.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface Chunk {
  doc: string;
  heading: string;
  text: string;
  tokens: string[];
}

const STOP = new Set("de la el i a les els en per que amb un una del dels al als és o no es se com sobre si y the of and to in is".split(" "));
const tokenize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

let chunks: Chunk[] | null = null;

function load(): Chunk[] {
  if (chunks) return chunks;
  const root = path.join(process.cwd(), "docs");
  const files = [
    ...["METHODOLOGY.md", "DATA_DICTIONARY.md", "DATA_SOURCES.md"].map((f) => path.join(root, f)),
    ...(existsSync(path.join(root, "knowledge")) ? readdirSync(path.join(root, "knowledge")).filter((f) => f.endsWith(".md")).map((f) => path.join(root, "knowledge", f)) : []),
  ].filter(existsSync);
  chunks = [];
  for (const file of files) {
    const doc = path.basename(file);
    let heading = doc;
    let buf: string[] = [];
    const flush = () => {
      const text = buf.join("\n").trim();
      if (text.length > 40) chunks!.push({ doc, heading, text: text.slice(0, 2500), tokens: tokenize(`${heading} ${text}`) });
      buf = [];
    };
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (/^#{1,3} /.test(line)) {
        flush();
        heading = line.replace(/^#+ /, "").trim();
      } else buf.push(line);
    }
    flush();
  }
  return chunks;
}

export function searchDocuments(query: string, k = 4) {
  const docs = load();
  if (!docs.length) return [];
  const q = tokenize(query);
  const N = docs.length;
  const avgdl = docs.reduce((a, d) => a + d.tokens.length, 0) / N;
  const df = new Map<string, number>();
  for (const t of new Set(q)) df.set(t, docs.filter((d) => d.tokens.includes(t)).length);
  const k1 = 1.4;
  const b = 0.75;
  return docs
    .map((d) => {
      let score = 0;
      for (const t of q) {
        const f = d.tokens.filter((x) => x === t).length;
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.tokens.length) / avgdl));
      }
      return { doc: d.doc, heading: d.heading, text: d.text, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
