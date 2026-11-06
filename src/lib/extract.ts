import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const Field = z.object({
  value: z.string().nullable().describe("Exactly as shown on screen, or null if not visible"),
  seen_text: z.string().nullable().describe("The visible text this came from"),
});

export const Extraction = z.object({
  product_name: Field,
  price_amount: z.number().nullable().describe("Visible price as a number, or null"),
  price_currency: z
    .string()
    .nullable()
    .describe("ISO code ONLY if a currency symbol or code is visible next to the price (e.g. ¥ on a Chinese platform → CNY, S$ → SGD). Otherwise null."),
  price_seen_text: z.string().nullable(),
  dimensions: Field,
  colour: Field,
  material: Field,
  supplier_or_shop: Field,
  platform: Field.describe("App or website, e.g. Taobao, Pinduoduo, 1688, Xiaohongshu, if recognisable from the screenshot"),
  model_number: Field,
  caution: z.string().nullable().describe("Anything ambiguous, e.g. a price range, a 'from' price, or several variants shown"),
});

export type ExtractionResult = z.infer<typeof Extraction>;

const SYSTEM = `You read product screenshots for a homeowner's renovation shopping list (sources include Taobao, Pinduoduo, 1688, Xiaohongshu, supplier sites and showroom photos).
Report only what is visibly shown. If a field is not visible, return null — never estimate or infer specifications.
Chinese text is fine; copy values as shown and you may add an English gloss in brackets.
If the price shown is a range, a "from" price, a discounted price, or applies to a different variant than the one pictured, say so in caution.`;

/** Read suggested fields from 1–4 images. Results are suggestions; the user confirms each one. */
export async function extractFromImages(images: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[]) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.slice(0, 4).map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } })),
          { type: "text" as const, text: "Extract the product details visible in these screenshot(s) of one product." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The image could not be read. Please enter the details manually.");
  if (!response.parsed_output) throw new Error("No details could be read. Please enter them manually.");
  return { result: response.parsed_output, model: response.model };
}
