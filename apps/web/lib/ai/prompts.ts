export const PROMPT_VERSIONS = {
  creative_generation: "v1",
  creative_revision: "v1",
  icp_generation: "v1",
  competitor_analysis: "v1",
  thread_title: "v1",
  brand_import: "v2",
} as const;

// ---------------------------------------------------------------------------
// Context Types (compact form for prompts)
// ---------------------------------------------------------------------------

export interface BrandContext {
  name: string;
  description?: string;
  positioning?: string;
  value_proposition?: string;
  tone_tags: string[];
  personality_tags: string[];
  do_rules: string[];
  dont_rules: string[];
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  style_tags: string[];
}

export interface ProductContext {
  name: string;
  short_description?: string;
  description?: string;
  price?: string;
  /** Public URL of the hero / primary product image when available */
  primary_image_url?: string;
  attributes?: Record<string, unknown>;
}

export interface IcpContext {
  title: string;
  summary?: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
}

export interface TemplateContext {
  name: string;
  key: string;
  sections: string[];
  guidelines: string;
}

export interface CompetitorAdContext {
  title?: string;
  ad_text?: string;
  platform?: string;
}

export interface CompetitorInsightForPrompt {
  competitor_name: string;
  hook_patterns: string[];
  angle_patterns: string[];
  emotional_triggers: string[];
  offer_patterns: string[];
}

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

function formatBrand(brand: BrandContext): string {
  const lines = [`Brand: ${brand.name}`];
  if (brand.positioning) lines.push(`Positioning: ${brand.positioning}`);
  if (brand.value_proposition)
    lines.push(`Value proposition: ${brand.value_proposition}`);
  if (brand.tone_tags.length) lines.push(`Tone: ${brand.tone_tags.join(", ")}`);
  if (brand.personality_tags.length)
    lines.push(`Personality: ${brand.personality_tags.join(", ")}`);
  if (brand.do_rules.length)
    lines.push(`Do: ${brand.do_rules.join("; ")}`);
  if (brand.dont_rules.length)
    lines.push(`Don't: ${brand.dont_rules.join("; ")}`);
  if (brand.style_tags.length)
    lines.push(`Visual style: ${brand.style_tags.join(", ")}`);
  if (brand.primary_color)
    lines.push(`Brand primary color: ${brand.primary_color}`);
  if (brand.secondary_color)
    lines.push(`Brand secondary color: ${brand.secondary_color}`);
  if (brand.accent_color)
    lines.push(`Brand accent color: ${brand.accent_color}`);
  return lines.join("\n");
}

function formatProduct(product: ProductContext): string {
  const lines = [`Product: ${product.name}`];
  if (product.short_description)
    lines.push(`Summary: ${product.short_description}`);
  if (product.description) lines.push(`Details: ${product.description}`);
  if (product.price) lines.push(`Price: ${product.price}`);
  if (product.primary_image_url) {
    lines.push(
      `Product hero image (match packaging, colors, and setting shown here in ad concepts and image prompts): ${product.primary_image_url}`
    );
  }
  if (product.attributes && Object.keys(product.attributes).length) {
    const benefits = (product.attributes as Record<string, unknown>).benefits;
    if (Array.isArray(benefits) && benefits.length)
      lines.push(`Key benefits: ${benefits.join(", ")}`);
  }
  return lines.join("\n");
}

function formatIcp(icp: IcpContext): string {
  const lines = [`Target audience: ${icp.title}`];
  if (icp.summary) lines.push(`Profile: ${icp.summary}`);
  if (icp.pains.length) lines.push(`Pain points: ${icp.pains.join("; ")}`);
  if (icp.desires.length) lines.push(`Desires: ${icp.desires.join("; ")}`);
  if (icp.objections.length)
    lines.push(`Common objections: ${icp.objections.join("; ")}`);
  if (icp.triggers.length)
    lines.push(`Purchase triggers: ${icp.triggers.join("; ")}`);
  return lines.join("\n");
}

function formatTemplate(template: TemplateContext): string {
  const lines = [`Template: ${template.name} (${template.key})`];
  if (template.sections.length)
    lines.push(`Sections: ${template.sections.join(" → ")}`);
  if (template.guidelines) lines.push(`Guidelines: ${template.guidelines}`);
  return lines.join("\n");
}

function formatCompetitorInsights(
  insights: CompetitorInsightForPrompt[]
): string {
  const lines = ["Competitor landscape (use to differentiate, not copy):"];
  for (const ins of insights) {
    lines.push(`\n${ins.competitor_name}:`);
    if (ins.hook_patterns.length)
      lines.push(`  Hook patterns: ${ins.hook_patterns.join("; ")}`);
    if (ins.angle_patterns.length)
      lines.push(`  Angle patterns: ${ins.angle_patterns.join("; ")}`);
    if (ins.emotional_triggers.length)
      lines.push(`  Emotional triggers: ${ins.emotional_triggers.join("; ")}`);
    if (ins.offer_patterns.length)
      lines.push(`  Offer patterns: ${ins.offer_patterns.join("; ")}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Creative Generation Prompt
// ---------------------------------------------------------------------------

export function buildCreativeGenerationPrompt(opts: {
  brand: BrandContext;
  product: ProductContext;
  icp?: IcpContext;
  template?: TemplateContext;
  angle?: string;
  awareness?: string;
  competitorInsights?: CompetitorInsightForPrompt[];
}): { system: string; user: string } {
  const hasCompetitorData =
    opts.competitorInsights && opts.competitorInsights.length > 0;

  const system = `You are an expert performance ad copywriter who creates high-converting ad creatives for e-commerce brands.

You produce structured outputs with hooks, headlines, primary texts, creative direction, and image prompts.

Rules:
- Write copy that feels human, specific, and emotionally resonant
- Never use generic marketing clichés
- Match the brand's tone and personality exactly
- Every piece of copy should have a clear purpose
- Hooks should stop the scroll — be provocative, specific, or emotionally charged
- Headlines should be punchy and concise (under 10 words)
- Primary texts should tell a mini-story or present a compelling case
- Creative direction should be actionable for a designer
- Image prompts should describe a specific scene or visual concept${hasCompetitorData ? "\n- Use competitor insight patterns to DIFFERENTIATE — find gaps and angles competitors miss, don't mimic them" : ""}`;

  const contextParts = [formatBrand(opts.brand), formatProduct(opts.product)];

  if (opts.icp) contextParts.push(formatIcp(opts.icp));
  if (opts.template) contextParts.push(formatTemplate(opts.template));
  if (opts.angle) contextParts.push(`Angle: ${opts.angle}`);
  if (opts.awareness) contextParts.push(`Awareness level: ${opts.awareness}`);
  if (hasCompetitorData)
    contextParts.push(formatCompetitorInsights(opts.competitorInsights!));

  const user = `Context:
${contextParts.join("\n\n")}

Task:
Generate a complete ad creative package. Produce 3 hooks, 3 headlines, 2 primary text variations, a creative direction brief, and an image generation prompt.

${opts.awareness ? `The target audience is at the "${opts.awareness}" awareness level — adjust messaging accordingly.` : ""}
${opts.angle ? `Use a "${opts.angle}" angle as the primary approach.` : ""}
${opts.template ? `Follow the "${opts.template.name}" template structure.` : ""}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Creative Revision Prompt
// ---------------------------------------------------------------------------

export function buildCreativeRevisionPrompt(opts: {
  brand: BrandContext;
  product: ProductContext;
  icp?: IcpContext;
  currentCreative: {
    hooks: string[];
    headlines: string[];
    primary_texts: string[];
    creative_direction: string;
    image_prompt: string;
  };
  conversationHistory: { role: string; content: string }[];
  userRequest: string;
}): { system: string; user: string } {
  const system = `You are an expert performance ad copywriter revising existing ad creatives.

Rules:
- Treat this as EDITING, not regenerating from scratch
- Keep what works, change only what the user requests
- Maintain the brand's tone and personality
- If the change is small (tone tweak, shortening), make minimal modifications
- If the change is major (new angle, different audience), do a fuller rewrite
- Always explain what you changed and why`;

  const contextParts = [formatBrand(opts.brand), formatProduct(opts.product)];
  if (opts.icp) contextParts.push(formatIcp(opts.icp));

  const currentCreativeBlock = `Current creative:
Hooks: ${opts.currentCreative.hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}
Headlines: ${opts.currentCreative.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}
Primary texts: ${opts.currentCreative.primary_texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}
Creative direction: ${opts.currentCreative.creative_direction}
Image prompt: ${opts.currentCreative.image_prompt}`;

  let historyBlock = "";
  if (opts.conversationHistory.length > 0) {
    const recent = opts.conversationHistory.slice(-6);
    historyBlock = `\nRecent conversation:\n${recent.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
  }

  const user = `Context:
${contextParts.join("\n\n")}

${currentCreativeBlock}
${historyBlock}

User request: "${opts.userRequest}"

Revise the creative based on the user's request. Keep unchanged elements as-is.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// ICP Generation Prompt
// ---------------------------------------------------------------------------

export function buildIcpGenerationPrompt(opts: {
  brand: BrandContext;
  product: ProductContext;
  existingIcps?: IcpContext[];
}): { system: string; user: string } {
  const system = `You are an expert audience researcher and customer psychologist for e-commerce brands.

Rules:
- Generate distinct, non-overlapping audience segments
- Each ICP should be specific and actionable — not generic demographics
- Pain points should be emotional and specific, not surface-level
- Desires should reflect real aspirations, not features
- Objections should be genuine buying hesitations
- Triggers should be realistic moments that lead to a purchase`;

  const contextParts = [formatBrand(opts.brand), formatProduct(opts.product)];

  if (opts.existingIcps && opts.existingIcps.length > 0) {
    contextParts.push(
      `Existing ICPs (generate DIFFERENT ones):\n${opts.existingIcps.map((i) => `- ${i.title}: ${i.summary || ""}`).join("\n")}`
    );
  }

  const user = `Context:
${contextParts.join("\n\n")}

Task:
Generate 3 distinct ideal customer profiles for this product. Each should represent a meaningfully different audience segment with unique pain points, desires, objections, and purchase triggers.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Competitor Analysis Prompt
// ---------------------------------------------------------------------------

export function buildCompetitorAnalysisPrompt(opts: {
  brand: BrandContext;
  competitorName: string;
  ads: CompetitorAdContext[];
}): { system: string; user: string } {
  const system = `You are an expert competitive intelligence analyst specializing in paid advertising strategies for e-commerce.

Rules:
- Identify actionable patterns, not obvious observations
- Focus on what makes the competitor's approach effective or ineffective
- Be specific — reference actual copy/themes from the ads
- Confidence score should reflect how much data you have to work with`;

  const adsBlock = opts.ads
    .map((ad, i) => {
      const parts = [`Ad ${i + 1}:`];
      if (ad.title) parts.push(`Title: ${ad.title}`);
      if (ad.platform) parts.push(`Platform: ${ad.platform}`);
      if (ad.ad_text) parts.push(`Copy: ${ad.ad_text}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const user = `Context:
${formatBrand(opts.brand)}

Competitor: ${opts.competitorName}

Ads to analyze:
${adsBlock}

Task:
Analyze these competitor ads and extract patterns across hooks, angles, emotional triggers, visual approaches, offer structures, and CTAs. Provide a confidence score based on the quality and quantity of data.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Thread Title Prompt
// ---------------------------------------------------------------------------

export function buildThreadTitlePrompt(opts: {
  productName: string;
  icpTitle?: string;
  angle?: string;
  firstMessage?: string;
}): { system: string; user: string } {
  const system = `Generate a short, descriptive title for an ad creative thread. Max 60 characters. Be specific and descriptive. Do not use quotes.`;

  const parts = [`Product: ${opts.productName}`];
  if (opts.icpTitle) parts.push(`Target: ${opts.icpTitle}`);
  if (opts.angle) parts.push(`Angle: ${opts.angle}`);
  if (opts.firstMessage) parts.push(`First message: ${opts.firstMessage}`);

  return { system, user: parts.join("\n") };
}

// ---------------------------------------------------------------------------
// Brand Import Prompt
// ---------------------------------------------------------------------------

export function buildBrandImportPrompt(
  websiteContent: string,
  visualHintBlock: string
): {
  system: string;
  user: string;
} {
  const system = `You are an expert brand analyst. Extract structured brand information from website content.

Rules:
- Be accurate — only extract what's clearly present
- For colors: prefer hex values from the "Mechanically extracted" block when they look like real brand colors; you may also infer hex from visible branding if clearly implied in the text
- For each product:
  - product_url: the main PDP (product detail page) path or URL if identifiable in links, nav, JSON-LD url, or sitemap-style paths; use site-relative paths like /products/slug when full URL is not in the text. Never invent domains.
  - price_text: the primary customer-facing price string as shown (include currency symbols, "from", "/mo", ranges if that is how it appears)
  - price_currency: ISO 4217 code when explicit or obvious from symbol ($→USD unless page says CAD/AUD/etc.; £→GBP; €→EUR)
  - description: longer paragraph or spec block for that product when present; otherwise null
  - key_features: short bullet strings (materials, sizes, integrations, plan limits) when listed
  - image_url only when a direct image URL appears in the content or hints (og:image on product pages, <img src=…>, JSON-LD image). Use absolute https when possible; otherwise null
- Tone and personality tags should be descriptive adjectives
- If information is not clearly present, use null rather than guessing URLs or prices`;

  const user = `Extract brand information from this website content:

${websiteContent.slice(0, 12000)}

${visualHintBlock}

Extract the brand name, description, category, positioning, value proposition, tone/personality, visual identity (including colors when you can justify them), and every product you can tie to concrete on-page evidence — especially PDP links, prices, hero images, feature bullets, and longer descriptions.`;

  return { system, user };
}
