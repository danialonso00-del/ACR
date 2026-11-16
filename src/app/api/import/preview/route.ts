import { jsonError } from "@/lib/api";
import { createPreview, MAX_BYTES } from "@/features/import/importer";

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) return jsonError(413, "Fitxer massa gran");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "Cal un fitxer");
  try {
    return Response.json(await createPreview(file));
  } catch (err) {
    return jsonError(422, (err as Error).message);
  }
}
