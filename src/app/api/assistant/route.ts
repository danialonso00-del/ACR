import { z } from "zod";
import { FiltersSchema } from "@/lib/analytics/filters";
import { buildScope } from "@/lib/analytics/scope";
import { getDataset } from "@/lib/data/repository";
import { comarcaNames } from "@/lib/geo/comarques";
import { jsonError } from "@/lib/api";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { GUIDED_QUERIES, runGuided } from "@/lib/ai/guided";
import { scopeLabelFor } from "@/features/reports/research";

export const maxDuration = 120;

const Body = z.object({
  filters: FiltersSchema.partial().default({}),
  question: z.string().trim().min(1).max(2000).optional(),
  guided: z.enum(GUIDED_QUERIES.map((q) => q.id) as [string, ...string[]]).optional(),
  sampleId: z.string().regex(/^\d{1,9}$/).optional(),
  // Opaque history returned by a previous turn; size-capped and shape-checked.
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() })).max(40).default([]),
});

/** Streams NDJSON AgentEvents. LLM mode only when ANTHROPIC_API_KEY is configured on the server. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 400_000) return jsonError(413, "Conversation too long; start a new one.");
  const parsed = Body.safeParse(JSON.parse(raw || "null"));
  if (!parsed.success) return jsonError(400, "Invalid request");
  const { question, guided, history, sampleId } = parsed.data;
  const filters = FiltersSchema.parse(parsed.data.filters);
  const ds = getDataset(filters.mode, filters.importId);
  if (!ds) return jsonError(404, "Dataset not available");
  const scope = buildScope(ds.records, ds.meta, filters);
  const circuitLabel = filters.circuit ? ds.circuits.find((c) => c.key === filters.circuit)?.label : undefined;
  const scopeLabel = scopeLabelFor(scope.filters, comarcaNames(filters.mode), circuitLabel);
  const origin = new URL(req.url).origin;
  const llm = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!guided && !llm) return jsonError(409, "Mode demostració sense model connectat: tria una consulta guiada.");
  if (!guided && !question) return jsonError(400, "Question required");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        if (guided) await runGuided({ id: guided as never, filters: { ...filters, from: scope.filters.from, to: scope.filters.to }, scopeLabel, origin, emit });
        else await runAgent({ question: question!, history: history as never, filters: { ...filters, from: scope.filters.from, to: scope.filters.to }, scopeLabel, sampleId, origin, signal: req.signal, emit });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
