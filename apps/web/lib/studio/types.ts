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
}

export interface ProductOption {
  id: string;
  name: string;
  short_description: string | null;
}

export interface IcpOption {
  id: string;
  title: string;
  summary: string | null;
  product_id: string;
}

export interface StudioContext {
  products: ProductOption[];
  icps: IcpOption[];
  templates: TemplateOption[];
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
