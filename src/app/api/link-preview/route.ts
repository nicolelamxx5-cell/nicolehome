import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getContext } from "@/lib/context";

// Fetches only a page title (Open Graph / <title>). Many Chinese platforms block
// this; the caller always falls back to manual entry. Guards against requests
// to private networks (SSRF).

function privateAddress(ip: string) {
  if (isIP(ip) === 6) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith("::ffff:127.") || ip === "::";
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  await getContext();
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  if (!/^https?:$/.test(url.protocol)) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  try {
    const addrs = await lookup(url.hostname, { all: true });
    if (addrs.some((a) => privateAddress(a.address))) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HomeHubLinkPreview/1.0)", Accept: "text/html" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return NextResponse.json({});
    const reader = res.body?.getReader();
    let html = "";
    while (reader && html.length < 200_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader?.cancel().catch(() => {});
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const title = og ?? html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
    return NextResponse.json(title ? { title: decode(title).slice(0, 300) } : {});
  } catch {
    return NextResponse.json({});
  }
}
