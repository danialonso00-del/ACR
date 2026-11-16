/**
 * Polite, read-only HTTP client for the ARC public SDR.
 *
 * - Host allowlist (prevents SSRF when URLs come from parsed pages).
 * - Single in-flight request and a minimum interval between requests.
 * - Timeouts, bounded retries with exponential backoff, response size cap.
 * - Identifies the client with a descriptive User-Agent (no personal data).
 * - Keeps a per-process session cookie because the legacy Struts app sets one.
 */

export const SDR_ORIGIN = "https://sdr.arc.cat";
const ALLOWED_HOSTS = new Set(["sdr.arc.cat"]);

export const SDR_USER_AGENT =
  process.env.SDR_USER_AGENT ?? "ARC-Intelligencia-Residus-Demo/0.1 (MTI technology demo; read-only; low rate)";

export interface SdrRequestOptions {
  method?: "GET" | "POST";
  form?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
  /** Override of the minimum spacing before this request (e.g. small on-demand thumbnails). */
  minIntervalMs?: number;
}

export interface SdrResponse {
  url: string;
  status: number;
  contentType: string | null;
  contentDisposition: string | null;
  body: Buffer;
  fetchedAt: string;
}

export class SdrError extends Error {
  constructor(
    message: string,
    readonly kind: "blocked_host" | "timeout" | "http" | "too_large" | "network",
    readonly status?: number,
  ) {
    super(message);
  }
}

const MIN_INTERVAL_MS = Number(process.env.SDR_MIN_INTERVAL_MS ?? 2000);
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();
let sessionCookie: string | null = null;

export function assertAllowedUrl(raw: string): URL {
  const url = new URL(raw, SDR_ORIGIN);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new SdrError(`Host not allowed: ${url.hostname}`, "blocked_host");
  }
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(url: URL, opts: SdrRequestOptions): Promise<SdrResponse> {
  const wait = lastRequestAt + (opts.minIntervalMs ?? MIN_INTERVAL_MS) - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const headers: Record<string, string> = {
    "User-Agent": SDR_USER_AGENT,
    Accept: "text/html,text/csv,image/*;q=0.9,*/*;q=0.5",
  };
  if (sessionCookie) headers.Cookie = sessionCookie;
  let body: string | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.form ? "POST" : "GET"),
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
    const setCookie = res.headers.get("set-cookie");
    const jsession = setCookie?.match(/JSESSIONID=[^;]+/)?.[0];
    if (jsession) sessionCookie = jsession;

    if (res.status >= 300 && res.status < 400) {
      // Only follow redirects that stay on the allowlist.
      const location = res.headers.get("location");
      if (!location) throw new SdrError(`Redirect without location (${res.status})`, "http", res.status);
      return once(assertAllowedUrl(new URL(location, url).toString()), { ...opts, form: undefined, method: "GET" });
    }
    if (!res.ok) throw new SdrError(`HTTP ${res.status} for ${url.pathname}`, "http", res.status);

    const maxBytes = opts.maxBytes ?? 25 * 1024 * 1024;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new SdrError(`Response too large (${declared} bytes)`, "too_large");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new SdrError(`Response too large (${buf.byteLength} bytes)`, "too_large");

    return {
      url: url.toString(),
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentDisposition: res.headers.get("content-disposition"),
      body: buf,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof SdrError) throw err;
    if ((err as Error).name === "AbortError") throw new SdrError(`Timeout for ${url.pathname}`, "timeout");
    throw new SdrError(`Network error for ${url.pathname}: ${(err as Error).message}`, "network");
  } finally {
    clearTimeout(timer);
  }
}

/** Serialised (concurrency 1) request with retries on timeouts, network errors and 5xx/429. */
export function sdrRequest(path: string, opts: SdrRequestOptions = {}): Promise<SdrResponse> {
  const url = assertAllowedUrl(path);
  const run = async () => {
    const retries = opts.retries ?? 3;
    for (let attempt = 0; ; attempt++) {
      try {
        return await once(url, opts);
      } catch (err) {
        const e = err as SdrError;
        const retryable =
          e.kind === "timeout" || e.kind === "network" || (e.kind === "http" && (e.status === 429 || (e.status ?? 0) >= 500));
        if (!retryable || attempt >= retries) throw e;
        await sleep(1000 * 2 ** attempt + Math.round(Math.random() * 400));
      }
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export function decodeLatin(buf: Buffer): string {
  return new TextDecoder("windows-1252").decode(buf);
}
