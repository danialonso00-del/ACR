import { jsonError } from "@/lib/api";
import { addItem } from "@/features/reports/store";
import { ReportItemSchema } from "@/features/reports/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = ReportItemSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid item");
  try {
    const r = addItem((await params).id, body.data);
    return r ? Response.json({ ok: true, items: r.items.length }) : jsonError(404, "Report not found");
  } catch (err) {
    return jsonError(409, (err as Error).message);
  }
}
