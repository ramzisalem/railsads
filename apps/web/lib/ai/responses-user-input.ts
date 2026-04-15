import type { ResponseInput } from "openai/resources/responses/responses";

/**
 * Plain string when no images; otherwise a single user message with text + vision inputs.
 */
export function buildResponsesUserInput(
  text: string,
  imageUrls: string[]
): string | ResponseInput {
  if (!imageUrls.length) return text;

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [{ type: "input_text", text }];

  for (const image_url of imageUrls) {
    content.push({
      type: "input_image",
      image_url,
      detail: "auto",
    });
  }

  return [{ role: "user", type: "message", content }];
}
