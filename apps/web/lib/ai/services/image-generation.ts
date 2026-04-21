import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient, MODELS } from "../provider";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { partitionAllowedReferenceImageUrls } from "@/lib/studio/chat-attachment-url";

export interface GenerateImageParams {
  brandId: string;
  threadId: string;
  prompt: string;
  userId: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  /**
   * Public URLs of images to use as visual references. When provided, we call
   * `images.edit` instead of `images.generate` so `gpt-image-1` preserves the
   * actual look of the real product (label, bottle shape, character, colors)
   * instead of hallucinating a generic version from the prompt text.
   *
   * Typically: [productHeroImage, ...recentChatAttachments]. Capped at 4.
   */
  referenceImageUrls?: string[];
}

export interface GenerateImageResult {
  output: {
    imageUrl: string;
    storagePath: string;
    assetId: string;
  };
  runId: string | null;
}

export async function generateImage(
  supabase: SupabaseClient,
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType: "image_generation",
    model: MODELS.image,
    // v1.2 = SSRF allowlist + collision-proof storage path + richer
    // response_payload (size, mode, ref_count, prompt length). Bump whenever
    // we change anything that affects the generated artifact OR the
    // observability shape of an image_generation run.
    promptVersion: "1.2",
    userId: params.userId,
  });

  try {
    const client = getOpenAIClient();

    // SSRF defense: every server-side fetch of a "reference image URL" goes
    // through our Supabase Storage allowlist. We accept ONLY public URLs in
    // buckets we own. Anything else is rejected before we hit the network so
    // an attacker can't smuggle internal IPs (169.254.169.254, etc.) or
    // arbitrary external hosts through this code path.
    const candidateRefs = (params.referenceImageUrls ?? []).slice(0, 4);
    const { allowed: refs, rejected } =
      partitionAllowedReferenceImageUrls(candidateRefs);
    if (rejected.length > 0) {
      console.warn(
        `[image-generation] dropped ${rejected.length} disallowed reference URL(s)`,
        { brandId: params.brandId, threadId: params.threadId }
      );
    }

    let response;
    if (refs.length > 0) {
      // gpt-image-1 supports passing real photos as references via images.edit;
      // the model uses them as the visual ground truth for the generation. The
      // text prompt is layered on top to control the scene, lighting, etc.
      const referenceFiles = await Promise.all(
        refs.map(async (url, idx) => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(
              `Failed to fetch reference image #${idx} (${res.status})`
            );
          }
          const buf = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get("content-type") ?? "image/png";
          const ext = contentType.includes("jpeg")
            ? "jpg"
            : contentType.includes("webp")
              ? "webp"
              : "png";
          return toFile(buf, `reference-${idx}.${ext}`, {
            type: contentType,
          });
        })
      );

      // input_fidelity: "high" tells gpt-image-1 to keep the reference pixels
      // closely — critical for product packaging text. The default ("low")
      // re-renders text from scratch, producing the gibberish-on-label artifact
      // ("DIAMWPE F2'FLAVOR" instead of the real copy).
      // quality: "high" gives the model more compute to render fine details
      // (small badges, ingredient lists, brand mark strokes) cleanly.
      response = await client.images.edit({
        model: MODELS.image,
        image: referenceFiles,
        prompt: params.prompt,
        n: 1,
        size: params.size ?? "1024x1024",
        input_fidelity: "high",
        quality: "high",
      });
    } else {
      response = await client.images.generate({
        model: MODELS.image,
        prompt: params.prompt,
        n: 1,
        size: params.size ?? "1024x1024",
        quality: "high",
      });
    }

    const imageData = response.data?.[0];
    if (!imageData || (!imageData.b64_json && !imageData.url)) {
      throw new Error("No image data returned from OpenAI");
    }

    let imageBuffer: Buffer;
    if (imageData.b64_json) {
      imageBuffer = Buffer.from(imageData.b64_json, "base64");
    } else {
      const fetchRes = await fetch(imageData.url!);
      const arrayBuffer = await fetchRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    // Collision-proof storage path. The previous `${threadId}/${Date.now()}.png`
    // collides under concurrent generations within the same millisecond
    // (auto-chain + an in-flight edit, two parallel turns on the same thread,
    // etc.) which causes `upsert: false` uploads to fail. We append a UUID
    // suffix so every artifact gets a globally unique key regardless of
    // request timing.
    const filename = `${params.threadId}/${Date.now()}-${randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("creative-assets")
      .upload(filename, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert({
        brand_id: params.brandId,
        kind: "generated_image",
        bucket: "creative-assets",
        storage_path: filename,
        mime_type: "image/png",
        file_size_bytes: imageBuffer.byteLength,
        width: parseInt(params.size?.split("x")[0] ?? "1024"),
        height: parseInt(params.size?.split("x")[1] ?? "1024"),
        metadata: {
          prompt: params.prompt,
          model: MODELS.image,
          thread_id: params.threadId,
          size: params.size ?? "1024x1024",
          mode: refs.length > 0 ? "edit" : "generate",
          reference_image_urls: refs,
        },
        created_by: params.userId,
      })
      .select("id")
      .single();

    if (assetError || !asset) {
      throw new Error(
        `Asset record creation failed: ${assetError?.message ?? "unknown"}`
      );
    }

    await supabase.from("creative_asset_links").insert({
      brand_id: params.brandId,
      thread_id: params.threadId,
      asset_id: asset.id,
      role: "selected",
      prompt_text: params.prompt,
    });

    if (runId) {
      // gpt-image-1 returns a `usage` object on the response (input/output
      // image tokens). When OpenAI exposes it we record the per-call token
      // counts so the same dashboards we use for text generation work for
      // image generation. The fields are typed loosely because the SDK
      // surface for image usage has evolved and we want to be tolerant.
      const usage = (
        response as unknown as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          };
        }
      ).usage;

      await completeAiRun(supabase, runId, {
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        totalTokens: usage?.total_tokens,
        responsePayload: {
          asset_id: asset.id,
          storage_path: filename,
          // Surface the run-shaping inputs so we can slice analytics by
          // mode (edit vs generate), aspect ratio, and prompt length without
          // joining back to the messages table.
          mode: refs.length > 0 ? "edit" : "generate",
          size: params.size ?? "1024x1024",
          reference_count: refs.length,
          reference_rejected_count:
            (params.referenceImageUrls?.length ?? 0) - refs.length,
          prompt_chars: params.prompt.length,
          input_fidelity: refs.length > 0 ? "high" : null,
          quality: "high",
        },
      });
    }

    const { data: publicUrl } = supabase.storage
      .from("creative-assets")
      .getPublicUrl(filename);

    return {
      output: {
        imageUrl: publicUrl.publicUrl,
        storagePath: filename,
        assetId: asset.id,
      },
      runId,
    };
  } catch (error) {
    if (runId) {
      await failAiRun(
        supabase,
        runId,
        error instanceof Error ? error.message : "Image generation failed"
      );
    }
    throw error;
  }
}
