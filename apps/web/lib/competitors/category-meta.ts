import {
  Eye,
  Heart,
  MousePointerClick,
  Tag,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CompetitorPatternCategory } from "./queries";

/** Per-category visual treatment shared by every place that surfaces
 *  competitor pattern groups (insights view, product-page Competitor
 *  Signals, etc.) so the same color/icon vocabulary is reinforced
 *  across the app. */
export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  /** Low-opacity background for the icon chip. */
  bg: string;
  /** Foreground used for the icon glyph and label text. */
  fg: string;
  /** Solid color used for tiny accent dots / bullets. */
  dot: string;
}

export const CATEGORY_META: Record<CompetitorPatternCategory, CategoryMeta> = {
  hook: {
    label: "Hook",
    icon: Zap,
    bg: "bg-amber-500/10",
    fg: "text-amber-500",
    dot: "bg-amber-500",
  },
  angle: {
    label: "Angle",
    icon: Target,
    bg: "bg-blue-500/10",
    fg: "text-blue-500",
    dot: "bg-blue-500",
  },
  emotional: {
    label: "Emotion",
    icon: Heart,
    bg: "bg-rose-500/10",
    fg: "text-rose-500",
    dot: "bg-rose-500",
  },
  visual: {
    label: "Visual",
    icon: Eye,
    bg: "bg-violet-500/10",
    fg: "text-violet-500",
    dot: "bg-violet-500",
  },
  offer: {
    label: "Offer",
    icon: Tag,
    bg: "bg-emerald-500/10",
    fg: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  cta: {
    label: "CTA",
    icon: MousePointerClick,
    bg: "bg-orange-500/10",
    fg: "text-orange-500",
    dot: "bg-orange-500",
  },
};
