/**
 * Assistant tools run against the real local public snapshot. They must
 * return limitations (not invented numbers) when evidence is missing and must
 * reject inputs outside their typed schema (e.g. SQL / extra fields).
 */
import { describe, expect, it } from "vitest";
import { parseFilters } from "@/lib/analytics/filters";
import { executeTool, ToolInputError, toolDefinitions } from "@/lib/ai/tools";
import { getDataset } from "@/lib/data/repository";
import { searchDocuments } from "@/lib/ai/documents";

const ctx = { baseFilters: parseFilters({}), origin: "http://localhost" };
const hasData = Boolean(getDataset("public_snapshot"));

describe.skipIf(!hasData)("assistant tools", () => {
  it("exposes typed JSON schemas without free-form query parameters", () => {
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name).sort()).toEqual(["compare_circuits", "create_report", "find_anomalies", "get_metric", "get_photos", "get_sample", "search_documents"]);
    for (const d of defs) {
      expect(d.input_schema.type).toBe("object");
      expect(JSON.stringify(d.input_schema)).not.toMatch(/"sql"|"query_sql"|"code"/);
    }
  });

  it("every numeric result carries evidence (period, unit, denominator, n, dataset)", async () => {
    const out = await executeTool("get_metric", { metric: "impropis" }, ctx);
    expect(typeof out.result.value_pct).toBe("number");
    expect(out.evidence).toMatchObject({ unit: expect.any(String), denominator: expect.any(String), dataset: expect.stringContaining("public_snapshot") });
    expect(out.evidence.n).toBeGreaterThan(1000);
    expect(out.evidence.period).toMatch(/^\d{4}-\d{2}\.\.\d{4}-\d{2}$/);
  });

  it("a question without data returns a limitation, never a number", async () => {
    const sample = await executeTool("get_sample", { id: "999999999" }, ctx);
    expect(sample.result).toHaveProperty("limitation");
    const circ = await executeTool("compare_circuits", { circuits: ["CIRCUIT QUE NO EXISTEIX", "ALTRE INEXISTENT"] }, ctx);
    expect(circ.result).toHaveProperty("limitation");
    expect(JSON.stringify(circ.result)).not.toMatch(/value_pct|mean/);
    const oldPeriod = await executeTool("get_metric", { metric: "impropis", scope: { from: "2010-01", to: "2010-12" } }, ctx);
    expect(oldPeriod.result.value_pct).toBeNull();
    expect(oldPeriod.evidence.scopeChange).toContain("Canvi d'àmbit");
  });

  it("rejects inputs outside the schema (no arbitrary SQL, no extra fields)", async () => {
    await expect(executeTool("get_metric", { metric: "SELECT * FROM characterization" }, ctx)).rejects.toBeInstanceOf(ToolInputError);
    await expect(executeTool("get_metric", { metric: "impropis", sql: "DROP TABLE x" }, ctx)).rejects.toBeInstanceOf(ToolInputError);
    await expect(executeTool("get_photos", { bulletin_ids: ["../../etc/passwd"] }, ctx)).rejects.toBeInstanceOf(ToolInputError);
  });

  it("treats observations as untrusted data, labelled as such", async () => {
    const out = await executeTool("get_sample", { id: "31301" }, ctx);
    expect(out.result).toHaveProperty("observations_untrusted_text");
    expect(out.evidence.links.some((l) => l.href.includes("31301"))).toBe(true);
  });

  it("reproduces the reported indicator for a known bulletin", async () => {
    const out = await executeTool("get_sample", { id: "31301" }, ctx);
    expect(out.result.impropis_pct_calculated).toBeCloseTo(out.result.impropis_pct_reported as number, 1);
  });

  it("retrieves methodology passages for method questions", () => {
    const hits = searchDocuments("denominador massa de referència pèrdues");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.text.toLowerCase()).toContain("referència");
  });
});
