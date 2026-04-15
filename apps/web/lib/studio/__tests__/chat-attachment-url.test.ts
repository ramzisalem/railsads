import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isAllowedChatAttachmentUrl,
  filterAllowedAttachmentUrls,
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
});
