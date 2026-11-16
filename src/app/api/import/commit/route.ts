import { z } from "zod";
import { jsonError } from "@/lib/api";
import { commitImport } from "@/features/import/importer";

const Body = z.object({ uploadId: z.string(), mapping: z.record(z.string(), z.number().int().min(0).max(199)), label: z.string().max(120).default("") });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request");
  try {
    return Response.json(commitImport(body.data.uploadId, body.data.mapping, body.data.label));
  } catch (err) {
    return jsonError(422, (err as Error).message);
  }
}
