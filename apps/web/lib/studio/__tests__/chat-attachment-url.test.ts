import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isAllowedChatAttachmentUrl,
  filterAllowedAttachmentUrls,
  isAllowedReferenceImageUrl,
  partitionAllowedReferenceImageUrls,
} from "../chat-attachment-url";

describe("chat-attachment-url", () => {
  const orig = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = orig;
  });

  it("allows public chat-attachment URLs on the project origin", () => {
    expect(
      isAllowedChatAttachmentUrl(
        "https://abc.supabase.co/storage/v1/object/public/chat-attachments/x/y/z.png"
      )
    ).toBe(true);
  });

  it("rejects other origins and paths", () => {
    expect(isAllowedChatAttachmentUrl("https://evil.com/x")).toBe(false);
    expect(
      isAllowedChatAttachmentUrl(
        "https://abc.supabase.co/storage/v1/object/public/creative-assets/x"
      )
    ).toBe(false);
  });

  it("filterAllowedAttachmentUrls caps and filters", () => {
    const ok =
      "https://abc.supabase.co/storage/v1/object/public/chat-attachments/a";
    expect(filterAllowedAttachmentUrls([ok, "https://evil.com/x", ok])).toEqual([
      ok,
      ok,
    ]);
  });

  describe("isAllowedReferenceImageUrl (SSRF allowlist)", () => {
    const chat =
      "https://abc.supabase.co/storage/v1/object/public/chat-attachments/a.png";
    const product =
      "https://abc.supabase.co/storage/v1/object/public/product-images/x/y.png";
    const creative =
      "https://abc.supabase.co/storage/v1/object/public/creative-assets/t/1.png";

    it("accepts public URLs in any owned bucket by default", () => {
      expect(isAllowedReferenceImageUrl(chat)).toBe(true);
      expect(isAllowedReferenceImageUrl(product)).toBe(true);
      expect(isAllowedReferenceImageUrl(creative)).toBe(true);
    });

    it("rejects other origins, even if the path looks valid", () => {
      expect(
        isAllowedReferenceImageUrl(
          "https://evil.com/storage/v1/object/public/chat-attachments/a.png"
        )
      ).toBe(false);
    });

    it("rejects private SSRF targets", () => {
      expect(
        isAllowedReferenceImageUrl("http://169.254.169.254/latest/meta-data/")
      ).toBe(false);
      expect(isAllowedReferenceImageUrl("http://localhost/secrets")).toBe(
        false
      );
      expect(isAllowedReferenceImageUrl("file:///etc/passwd")).toBe(false);
    });

    it("rejects buckets we don't own", () => {
      expect(
        isAllowedReferenceImageUrl(
          "https://abc.supabase.co/storage/v1/object/public/some-other-bucket/x"
        )
      ).toBe(false);
    });

    it("can narrow to a specific bucket", () => {
      expect(isAllowedReferenceImageUrl(chat, ["product-images"])).toBe(false);
      expect(isAllowedReferenceImageUrl(product, ["product-images"])).toBe(
        true
      );
    });

    it("partitionAllowedReferenceImageUrls splits allowed/rejected", () => {
      const result = partitionAllowedReferenceImageUrls([
        chat,
        "https://evil.com/x",
        product,
      ]);
      expect(result.allowed).toEqual([chat, product]);
      expect(result.rejected).toEqual(["https://evil.com/x"]);
    });
  });
});
