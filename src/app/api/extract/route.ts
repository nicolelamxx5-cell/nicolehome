import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { extractFromImages } from "@/lib/extract";
import { env } from "@/lib/env";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!env.aiEnabled) return NextResponse.json({ error: "Screenshot reading is not set up" }, { status: 404 });
  const { supabase } = await getContext();
  const body = z.object({ optionId: z.string().uuid() }).safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { data: imgs } = await supabase
    .from("option_images")
    .select("storage_path")
    .eq("option_id", body.data.optionId)
    .order("sort_order")
    .limit(4);
  if (!imgs?.length) return NextResponse.json({ error: "Add a screenshot first" }, { status: 400 });
  const images = [];
  for (const i of imgs) {
    const { data } = await supabase.storage.from("household-files").download(i.storage_path);
    if (!data) continue;
    const type = data.type === "image/png" || data.type === "image/webp" || data.type === "image/gif" ? data.type : "image/jpeg";
    images.push({ data: Buffer.from(await data.arrayBuffer()).toString("base64"), mediaType: type as "image/jpeg" });
  }
  try {
    const { result, model } = await extractFromImages(images);
    const suggestions = { ...result, model, extracted_at: new Date().toISOString(), verified: false };
    await supabase.from("product_options").update({ ai_suggestions: suggestions }).eq("id", body.data.optionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read the screenshot" }, { status: 502 });
  }
}
