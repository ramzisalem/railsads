import type { ImageGenRatioGlyphId } from "@/lib/studio/image-gen-sizes";
import { cn } from "@/lib/utils";

/** Small frame icons so ratio presets read at a glance. */
export function AspectRatioGlyph({
  ratio,
  className,
}: {
  ratio: ImageGenRatioGlyphId;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-current",
        className
      )}
      aria-hidden
    >
      {ratio === "4:3" && (
        <svg viewBox="0 0 20 15" className="h-3.5 w-[18px]" fill="none">
          <rect
            x="1"
            y="1"
            width="18"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
      {ratio === "16:9" && (
        <svg viewBox="0 0 32 18" className="h-3 w-[22px]" fill="none">
          <rect
            x="1"
            y="1"
            width="30"
            height="16"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
      {ratio === "9:16" && (
        <svg viewBox="0 0 18 32" className="h-[22px] w-3" fill="none">
          <rect
            x="1"
            y="1"
            width="16"
            height="30"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </span>
  );
}
