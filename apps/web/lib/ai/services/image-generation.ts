import { randomUUID } from "node:crypto";
import type { Part } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGeminiImageClient, MODELS } from "../provider";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { partitionAllowedReferenceImageUrls } from "@/lib/studio/chat-attachment-url";
import {
  imageGenSizeToGeminiAspectRatio,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";

export interface GenerateImageParams {
  brandId: string;
  threadId: string;
  prompt: string;
  userId: string;
  size?: ImageGenSize;
  /**
   * Public URLs of images to use as visual references. When provided, we send
   * them as Gemini `inlineData` parts before the text prompt so Nano Banana 2
   * can condition on real product pixels (same intent as the old OpenAI
   * `images.edit` path).
   *
   * Typically: [productHeroImage, ...recentChatAttachments]. Capped at 4.
   */
  referenceImageUrls?: string[];
  /**
   * First-time chat image vs modal edit chain — drives `ai_runs.service_type`
   * (and should match the billing `usage_events.event_type` at the route).
   */
  imageServiceType?: "image_generation" | "image_edit";
}

export interface GenerateImageResult {
  output: {
    imageUrl: string;
    storagePath: string;
    assetId: string;
  };
  runId: string | null;
}

function mimeFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
  if (ct.includes("webp")) return "image/webp";
  return "image/png";
}

function extractImageFromGeminiResponse(response: {
  candidates?: Array<{
    content?: { parts?: Part[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
}): Buffer {
  const pf = response.promptFeedback;
  if (pf?.blockReason) {
    const msg = pf.blockReasonMessage
      ? `${pf.blockReason}: ${pf.blockReasonMessage}`
      : String(pf.blockReason);
    throw new Error(`Image prompt blocked (${msg})`);
  }

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) {
      return Buffer.from(data, "base64");
    }
  }

  const finish = candidate?.finishReason;
  if (finish && finish !== "STOP") {
    throw new Error(
      `No image in model response (finishReason=${finish}). Try adjusting the prompt.`
    );
  }

  throw new Error("No image data returned from Gemini");
}

export async function generateImage(
  supabase: SupabaseClient,
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const serviceType = params.imageServiceType ?? "image_generation";
  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType,
    model: MODELS.image,
    // Bump when switching image backends or changing observability fields.
    promptVersion: serviceType === "image_edit" ? "1.3-nb2-edit" : "1.3-nb2",
    userId: params.userId,
  });

  try {
    const ai = getGeminiImageClient();

    const candidateRefs = (params.referenceImageUrls ?? []).slice(0, 4);
    const { allowed: allowedUrls, rejected } =
      partitionAllowedReferenceImageUrls(candidateRefs);
    if (rejected.length > 0) {
      console.warn(
        `[image-generation] dropped ${rejected.length} disallowed reference URL(s)`,
        { brandId: params.brandId, threadId: params.threadId }
      );
    }

    const refParts: Part[] = [];
    for (let i = 0; i < allowedUrls.length; i++) {
      const url = allowedUrls[i];
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch reference image #${i} (${res.status})`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/png";
      refParts.push({
        inlineData: {
          mimeType: mimeFromContentType(contentType),
          data: buf.toString("base64"),
        },
      });
    }

    const size = params.size ?? "1024x1024";
    const aspectRatio = imageGenSizeToGeminiAspectRatio(size);

    const contents: Part[] = [
      ...refParts,
      {
        text: params.prompt,
      },
    ];

    const response = await ai.models.generateContent({
      model: MODELS.image,
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize: "1K",
        },
      },
    });

    const imageBuffer = extractImageFromGeminiResponse(response);

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
        width: parseInt(size.split("x")[0] ?? "1024"),
        height: parseInt(size.split("x")[1] ?? "1024"),
        metadata: {
          prompt: params.prompt,
          model: MODELS.image,
          image_provider: "google_genai",
          thread_id: params.threadId,
          size,
          aspect_ratio: aspectRatio,
          mode: refParts.length > 0 ? "edit" : "generate",
          reference_image_urls: allowedUrls,
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
      const um = response.usageMetadata;
      await completeAiRun(supabase, runId, {
        inputTokens: um?.promptTokenCount,
        outputTokens: um?.candidatesTokenCount,
        totalTokens: um?.totalTokenCount,
        responsePayload: {
          asset_id: asset.id,
          storage_path: filename,
          provider: "google_genai",
          model: MODELS.image,
          mode: refParts.length > 0 ? "edit" : "generate",
          size,
          aspect_ratio: aspectRatio,
          image_size: "1K",
          reference_count: refParts.length,
          reference_rejected_count:
            (params.referenceImageUrls?.length ?? 0) - allowedUrls.length,
          prompt_chars: params.prompt.length,
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
