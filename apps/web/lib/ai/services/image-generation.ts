import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient, MODELS } from "../provider";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface GenerateImageParams {
  brandId: string;
  threadId: string;
  prompt: string;
  userId: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
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
    promptVersion: "1.0",
    userId: params.userId,
  });

  try {
    const client = getOpenAIClient();
    const response = await client.images.generate({
      model: MODELS.image,
      prompt: params.prompt,
      n: 1,
      size: params.size ?? "1024x1024",
    });

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

    const filename = `${params.threadId}/${Date.now()}.png`;
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
      await completeAiRun(supabase, runId, {
        responsePayload: {
          asset_id: asset.id,
          storage_path: filename,
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
