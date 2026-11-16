/**
 * Agent loop with a stubbed SDK stream (no network): tools are executed in
 * code, results are appended as tool_result blocks, history is append-only,
 * and refusals / unknown tools surface as errors instead of invented answers.
 */
import { describe, expect, it } from "vitest";
import { parseFilters } from "@/lib/analytics/filters";
import { getDataset } from "@/lib/data/repository";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";

type Msg = { content: unknown[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };

function fakeClient(turns: Msg[]) {
  const calls: unknown[] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: { messages: unknown[] }) => {
          calls.push(JSON.parse(JSON.stringify(params.messages)));
          const msg = turns.shift()!;
          const listeners: ((t: string) => void)[] = [];
          return {
            on: (ev: string, fn: (t: string) => void) => {
              if (ev === "text") listeners.push(fn);
            },
            finalMessage: async () => {
              for (const b of msg.content as { type: string; text?: string }[]) if (b.type === "text") listeners.forEach((l) => l(b.text!));
              return msg;
            },
          };
        },
      },
    },
  };
  return { client: client as never, calls };
}

const usage = { input_tokens: 100, output_tokens: 20 };
const run = async (turns: Msg[]) => {
  const { client, calls } = fakeClient(turns);
  const events: AgentEvent[] = [];
  await runAgent({ question: "Quin és el % d'impropis?", history: [], filters: parseFilters({}), scopeLabel: "test", origin: "http://x", signal: new AbortController().signal, emit: (e) => events.push(e), client });
  return { events, calls };
};

describe.skipIf(!getDataset("public_snapshot"))("agent loop", () => {
  it("executes typed tools in code and returns their evidence to the model", async () => {
    const { events, calls } = await run([
      { content: [{ type: "tool_use", id: "t1", name: "get_metric", input: { metric: "impropis" } }], stop_reason: "tool_use", usage },
      { content: [{ type: "text", text: "**Dada observada** — segons l'eina." }], stop_reason: "end_turn", usage },
    ]);
    const result = events.find((e) => e.type === "tool_result");
    expect(result && result.type === "tool_result" && result.ok).toBe(true);
    const second = calls[1] as { role: string; content: { type: string; content?: string }[] }[];
    const toolMsg = second.at(-1)!;
    expect(toolMsg.role).toBe("user");
    expect(toolMsg.content[0]!.type).toBe("tool_result");
    expect(toolMsg.content[0]!.content).toContain("evidence");
    const history = events.find((e) => e.type === "history");
    expect(history && history.type === "history" && history.messages.length).toBe(4); // user, assistant(tool_use), user(tool_result), assistant(text)
    expect(events.at(-1)).toEqual({ type: "done", stop: "end_turn" });
  });

  it("invalid tool input becomes an error tool_result, not an exception or a number", async () => {
    const { events } = await run([
      { content: [{ type: "tool_use", id: "t1", name: "get_metric", input: { metric: "DROP TABLE" } }], stop_reason: "tool_use", usage },
      { content: [{ type: "text", text: "No puc respondre amb aquesta entrada." }], stop_reason: "end_turn", usage },
    ]);
    const r = events.find((e) => e.type === "tool_result");
    expect(r && r.type === "tool_result" && r.ok).toBe(false);
    expect(r && r.type === "tool_result" && r.error).toMatch(/INVALID_INPUT/);
  });

  it("surfaces refusals as errors", async () => {
    const { events } = await run([{ content: [], stop_reason: "refusal", usage }]);
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});
