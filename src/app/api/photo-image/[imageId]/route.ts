import { getDataset } from "@/lib/data/repository";
import { getImage, isKnownImage } from "@/lib/sdr/photos";
import { jsonError } from "@/lib/api";

/**
 * Image proxy restricted to image ids that appear in an indexed or fetched
 * gallery (no enumeration of arbitrary ids). Content type is sniffed from
 * the bytes because the source sends a non-standard Content-Type.
 */
export async function GET(req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  if (!/^\d{1,10}$/.test(imageId)) return jsonError(400, "Invalid image id");
  const ds = getDataset("public_snapshot");
  if (!ds || !isKnownImage(ds, imageId)) return jsonError(404, "Unknown image");
  const size = new URL(req.url).searchParams.get("size") === "full" ? "full" : "thumb";
  try {
    const img = await getImage(imageId, size);
    return new Response(new Uint8Array(img.body), {
      headers: {
        "Content-Type": img.type,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Sha256": img.sha256,
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    return jsonError(502, `Image unavailable: ${(err as Error).message}`);
  }
}
