export interface ThreadListItem {
  id: string;
  title: string | null;
  product_name: string;
  icp_title: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
}

export interface ThreadDetail {
  id: string;
  brand_id: string;
  product_id: string;
  icp_id: string | null;
  template_id: string | null;
  reference_competitor_ad_id: string | null;
  title: string | null;
  angle: string | null;
  awareness: string | null;
  status: string;
  active_version_id: string | null;
  created_at: string;
}

export interface GeneratedImage {
  url: string;
  asset_id: string;
  storage_path: string;
  prompt: string;
  /** When this image was produced by editing a previous one, links back to it. */
  parent_asset_id?: string | null;
  parent_message_id?: string | null;
  /** Free-text description of the change requested in this iteration. */
  edit_prompt?: string | null;
}

export interface StructuredPayload {
  hooks?: string[];
  headlines?: string[];
  primary_texts?: string[];
  creative_direction?: string;
  image_prompt?: string;
  recommendation?: string;
  change_summary?: string;
  generated_image?: GeneratedImage;
  /** User-authored chat attachments (not part of model creative schema) */
  attachments?: Array<{ type: "image"; url: string }>;
  [key: string]: unknown;
}

export interface MessageItem {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  structured_payload: StructuredPayload | null;
  created_at: string;
}

export interface TemplateOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  /** Public URL of the template preview image (system thumbnail or brand upload). */
  thumbnail_url: string | null;
  /** True when the template ships with the app — brand-uploaded ones can be deleted. */
  is_system: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  short_description: string | null;
  /** Public URL of the primary product image, when imported. */
  image_url: string | null;
}

export interface IcpOption {
  id: string;
  title: string;
  summary: string | null;
  product_id: string;
  is_primary: boolean;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
}

export interface CompetitorAdOption {
  id: string;
  competitor_id: string;
  competitor_name: string;
  /** Mapped product, when the user has linked the ad to a specific product. */
  mapped_product_id: string | null;
  title: string | null;
  ad_text: string | null;
  platform: string | null;
  source_url: string | null;
  landing_page_url: string | null;
  /** Public URL of the primary screenshot, when available. */
  image_url: string | null;
}

export interface StudioContext {
  products: ProductOption[];
  icps: IcpOption[];
  templates: TemplateOption[];
  competitorAds: CompetitorAdOption[];
}

export const AWARENESS_LEVELS = [
  { value: "unaware", label: "Unaware" },
  { value: "problem_aware", label: "Problem Aware" },
  { value: "solution_aware", label: "Solution Aware" },
  { value: "product_aware", label: "Product Aware" },
  { value: "most_aware", label: "Most Aware" },
] as const;

export const ANGLE_PRESETS = [
  "Problem-focused",
  "Benefit-focused",
  "Transformation",
  "Before / After",
  "Social proof",
  "Urgency",
  "Curiosity",
] as const;
