import { parseFilters } from "@/lib/analytics/filters";
import { getDataset } from "@/lib/data/repository";
import { getGallery } from "@/lib/sdr/photos";
import { jsonError } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ bulletinId: string }> }) {
  const { bulletinId } = await params;
  const filters = parseFilters(new URL(req.url).searchParams);
  const ds = getDataset(filters.mode, filters.importId);
  if (!ds) return jsonError(404, "Dataset not available");
  const result = await getGallery(ds, bulletinId);
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
