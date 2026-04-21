export const PROMPT_VERSIONS = {
  // v2 = image_prompt MUST include the chosen hook + headline as on-image
  // text overlays (with exact wording, position, typography). The image
  // model then renders the finished ad — copy and visual together.
  // v2.1 = anti-clipping: positions must be expressed as insets from the
  // canvas edge so descenders / last lines are never cropped at the frame.
  creative_generation: "v2.1",
  creative_revision: "v2.1",
  icp_generation: "v1",
  // v2 = multimodal-aware (passes ad images alongside copy) + cited evidence
  // (every pattern in the output must reference back to the ads that
  // demonstrate it). v2.1 adds optional product scoping for "what's working
  // for this product?" runs. v2.2 supports incremental analysis: the prior
  // insight is shown to the model and only NEW ads are sent so the model
  // can extend / refine instead of re-deriving from scratch. v2.3 stabilizes
  // the summary on incremental runs (treat prior summary as canonical;
  // adjust only when new ads materially change the picture).
  competitor_analysis: "v2.3",
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
  /** When set (e.g. from `color_palette` in DB), prompts list colors by role. */
  color_palette?: { segment: string; hex: string }[];
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
  /** Stable DB uuid — used to map model citations back to rows. */
  id: string;
  /** Short reference label like "ad-1" used in the prompt + citations. */
  ref: string;
  title?: string;
  ad_text?: string;
  platform?: string;
  /** Primary screenshot / scraped image URL when available. */
  image_url?: string;
  source_url?: string;
  landing_page_url?: string;
}

export interface CompetitorInsightForPrompt {
  competitor_name: string;
  hook_patterns: string[];
  angle_patterns: string[];
  emotional_triggers: string[];
  offer_patterns: string[];
}

export interface CompetitorReferenceAd {
  competitor_name: string;
  title?: string | null;
  platform?: string | null;
  ad_text?: string | null;
  /** Public URL to the screenshot — pass alongside the prompt as input_image. */
  image_url?: string | null;
  source_url?: string | null;
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
  if (brand.color_palette?.length) {
    lines.push(
      `Brand colors (use these roles in layout and imagery):\n${brand.color_palette
        .map((c) => `- ${c.segment}: ${c.hex}`)
        .join("\n")}`
    );
  } else {
    if (brand.primary_color)
      lines.push(`Brand primary color: ${brand.primary_color}`);
    if (brand.secondary_color)
      lines.push(`Brand secondary color: ${brand.secondary_color}`);
    if (brand.accent_color)
      lines.push(`Brand accent color: ${brand.accent_color}`);
  }
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

function formatReferenceAd(ad: CompetitorReferenceAd): string {
  const lines = [
    `Pinned competitor reference (use ONLY for composition / angle / hook style — never copy claims, brand marks, or prices verbatim):`,
    `- Competitor: ${ad.competitor_name}`,
  ];
  if (ad.title) lines.push(`- Reference title: ${ad.title}`);
  if (ad.platform) lines.push(`- Platform: ${ad.platform}`);
  if (ad.ad_text)
    lines.push(`- Reference copy:\n${truncate(ad.ad_text, 800)}`);
  if (ad.image_url)
    lines.push(
      `- Reference image attached as input. Match its layout, framing, and energy — but render OUR product / palette / typography.`
    );
  if (ad.source_url) lines.push(`- Source: ${ad.source_url}`);
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
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
  referenceAd?: CompetitorReferenceAd;
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
- Creative direction should be actionable for a designer${hasCompetitorData ? "\n- Use competitor insight patterns to DIFFERENTIATE — find gaps and angles competitors miss, don't mimic them" : ""}

CRITICAL — image_prompt construction:
The image_prompt is rendered as a FINISHED AD by an image model — not a generic product photo. It MUST describe the entire ad as a single composed scene that includes:
  1. The visual concept (subject, scene, lighting, mood, composition).
  2. The strongest hook from the "hooks" list, baked into the image as on-image text. Quote the EXACT wording in double quotes inside the image_prompt. Specify its position INSIDE THE TEXT-SAFE AREA (e.g. "centered horizontally, baseline at ~15% from the top — never touching the top edge"), typography (style, weight, color drawn from the brand palette), and treatment (subtle shadow, outline, etc.). Keep it short and legible.
  3. The strongest headline from the "headlines" list, baked into the image as a secondary on-image text element. Quote the EXACT wording. Specify its position INSIDE THE TEXT-SAFE AREA (e.g. "centered horizontally, baseline at ~85% from the top — leaving a 10–15% bottom margin so descenders never clip"), typography, and color.
  4. Explicit negative space / safe zones so both text elements remain legible against the underlying scene (e.g. "darker gradient at the bottom for headline contrast", "blurred background in the upper third").
  5. The product placed in the scene per the creative direction.

NEVER CLIP TEXT: when describing text position, always frame it as an inset from the edge ("inset from the top by ~10%", "lower third with a 15% bottom margin"), never flush against the edge ("at the very bottom", "anchored to the bottom edge"). Keep on-image copy SHORT — prefer one line, two lines max — to leave room for safe rendering inside the canvas.

Order of importance for picking which hook + headline to bake in: pick the pair that reads as a complete ad on its own (hook = scroll-stopper, headline = clarity / value prop). The first hook + first headline in your output arrays are treated as your top recommendation.

Do NOT describe ad copy as something to be added later or in post — write the image_prompt as if the image model will produce the FINAL deliverable, ready to upload to Meta / TikTok / YouTube.`;

  const contextParts = [formatBrand(opts.brand), formatProduct(opts.product)];

  if (opts.icp) contextParts.push(formatIcp(opts.icp));
  if (opts.template) contextParts.push(formatTemplate(opts.template));
  if (opts.angle) contextParts.push(`Angle: ${opts.angle}`);
  if (opts.awareness) contextParts.push(`Awareness level: ${opts.awareness}`);
  if (hasCompetitorData)
    contextParts.push(formatCompetitorInsights(opts.competitorInsights!));
  if (opts.referenceAd) contextParts.push(formatReferenceAd(opts.referenceAd));

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
  referenceAd?: CompetitorReferenceAd;
}): { system: string; user: string } {
  const system = `You are an expert performance ad copywriter revising existing ad creatives.

Rules:
- Treat this as EDITING, not regenerating from scratch
- Keep what works, change only what the user requests
- Maintain the brand's tone and personality
- If the change is small (tone tweak, shortening), make minimal modifications
- If the change is major (new angle, different audience), do a fuller rewrite
- Always explain what you changed and why

CRITICAL — image_prompt construction:
The image_prompt is rendered as a FINISHED AD with on-image copy by an image model. After making your revisions:
  - Identify your strongest revised hook (first item in the revised hooks array) and strongest revised headline (first item in the revised headlines array).
  - Rewrite image_prompt so it bakes BOTH of those exact strings into the scene as on-image text overlays.
    * Quote the hook and headline in double quotes inside the image_prompt.
    * Specify position INSIDE THE TEXT-SAFE AREA — always express positions as insets from the edge (e.g. "hook baseline at ~15% from the top, never touching the top edge", "headline baseline at ~85% from the top with a 10–15% bottom margin so descenders never clip"). Never use flush-to-edge wording ("at the very bottom", "anchored to the bottom edge").
    * Specify typography (weight, brand-aligned color) and treatment (shadow / outline) for each.
    * Reserve negative space in the layout so both remain legible against the scene.
    * Keep on-image copy SHORT — prefer one line, two lines max — to leave room for safe rendering inside the canvas.
  - If the user's request only changed copy and not the visual concept, keep the underlying scene the same and only update the on-image text strings + their styling.
  - If the user's request changed the visual, rebuild the scene AND update the on-image text strings to match the new revised copy.
  - Never describe text as "to be added later" — the image_prompt must produce a finished ad ready to upload.`;

  const contextParts = [formatBrand(opts.brand), formatProduct(opts.product)];
  if (opts.icp) contextParts.push(formatIcp(opts.icp));
  if (opts.referenceAd) contextParts.push(formatReferenceAd(opts.referenceAd));

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

/** Optional snapshot of the most recent insight, passed when the user is
 *  doing an incremental run over only the newly-added ads. The model is
 *  instructed to merge instead of starting from zero. */
export interface PreviousCompetitorInsight {
  summary?: string | null;
  hook_patterns: string[];
  angle_patterns: string[];
  emotional_triggers: string[];
  visual_patterns: string[];
  offer_patterns: string[];
  cta_patterns: string[];
}

export function buildCompetitorAnalysisPrompt(opts: {
  brand: BrandContext;
  competitorName: string;
  ads: CompetitorAdContext[];
  /** When set, scopes the analysis to "what's working for this product". */
  product?: ProductContext;
  /** When set, the analysis is incremental: `ads` are NEW ads not yet
   *  reflected in the previous insight. The model is asked to extend
   *  rather than re-derive. */
  previous?: PreviousCompetitorInsight;
}): { system: string; user: string } {
  const productScoped = !!opts.product;
  const incremental = !!opts.previous;

  const system = `You are an expert competitive intelligence analyst specializing in paid advertising strategies for e-commerce.

Rules:
- Identify actionable patterns, not obvious observations.
- Focus on what makes the competitor's approach effective or ineffective.
- Be specific — reference actual copy/themes from the ads.
- Each pattern you list must be backed by AT LEAST ONE ad in the evidence array.
- For every pattern in any *_patterns array, add an evidence entry whose \`pattern\` field is the exact same string and whose \`evidence_ad_ids\` lists the ad refs (e.g. "ad-1", "ad-2") that demonstrate it.
- It's fine if multiple patterns cite the same ad. Don't invent ad refs that aren't in the input.
- Confidence score should reflect how much data you have to work with — fewer ads, lower confidence.${productScoped ? "\n- This run is SCOPED to a single one of our products. Phrase patterns and notes through the lens of \"what would work to advertise this product against this competitor\"." : ""}${incremental ? `\n\nINCREMENTAL MODE:
- A "Previous insight" block is included below. Treat it as the existing baseline.
- The "Ads to analyze" block contains ONLY new ads not seen in the previous run.
- Output the FULL updated lists (not just deltas). Keep prior patterns that remain valid; ADD new patterns supported by the new ads; REPHRASE only when the new evidence sharpens or contradicts an old pattern.
- When a new pattern is essentially the same as a prior one, REUSE the exact prior wording so they merge cleanly.
- Evidence: only cite ad refs from the "Ads to analyze" block (the new ads). Older ads' evidence is preserved automatically by the server for unchanged patterns.
- Summary: Treat the previous summary as canonical. Adjust it ONLY where the new ads materially change the picture (a brand-new pattern, a contradicted pattern, or a shifted overall strategy). Otherwise reuse the prior wording. Do NOT rewrite stylistic prose just to sound different — stability across runs is more useful than novelty.` : ""}

If image inputs are attached, integrate visual observations into visual_patterns and use them to validate copy claims.`;

  const adsBlock = opts.ads
    .map((ad) => {
      const parts = [`${ad.ref}:`];
      if (ad.title) parts.push(`  Title: ${ad.title}`);
      if (ad.platform) parts.push(`  Platform: ${ad.platform}`);
      if (ad.ad_text) parts.push(`  Copy: ${ad.ad_text}`);
      if (ad.image_url) parts.push(`  Has attached image: yes`);
      if (ad.landing_page_url) parts.push(`  Landing page: ${ad.landing_page_url}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const productBlock = opts.product
    ? `\n\nOur product to defend / out-position:\n${formatProduct(opts.product)}`
    : "";

  const previousBlock = opts.previous
    ? `\n\nPrevious insight (baseline to extend):${
        opts.previous.summary ? `\nSummary: ${opts.previous.summary}` : ""
      }
${formatPatternList("Hooks", opts.previous.hook_patterns)}
${formatPatternList("Angles", opts.previous.angle_patterns)}
${formatPatternList("Emotional triggers", opts.previous.emotional_triggers)}
${formatPatternList("Visual patterns", opts.previous.visual_patterns)}
${formatPatternList("Offer patterns", opts.previous.offer_patterns)}
${formatPatternList("CTA patterns", opts.previous.cta_patterns)}`
    : "";

  const user = `Context:
${formatBrand(opts.brand)}${productBlock}${previousBlock}

Competitor: ${opts.competitorName}

${incremental ? "New ads to fold into the baseline" : "Ads to analyze"} (each ad has a stable reference id):
${adsBlock}

Task:
${
  incremental
    ? "Update the previous insight with what these new ads add or change. Output the full merged lists, citing the new ads via the `evidence` array. Confidence reflects total evidence (old + new)."
    : "Analyze these competitor ads and extract patterns across hooks, angles, emotional triggers, visual approaches, offer structures, and CTAs. Cite which ads back each pattern via the `evidence` array using the ad reference ids above. Provide a confidence score based on the quality and quantity of data."
}`;

  return { system, user };
}

function formatPatternList(label: string, items: string[]): string {
  if (items.length === 0) return `${label}: (none yet)`;
  return `${label}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
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

The body text contains inline tokens you should use:
- [IMG src=URL alt="…"] — every <img> on the page with its alt text. Bind these to the nearest product name / heading text in the surrounding context.
- [LINK href=URL] … [/LINK] — anchors with their visible text inside. Use for product_url.

Rules:
- Be accurate — only extract what's clearly present
- For colors: pick directly from the "CSS / inline color candidates" list in the hint block (it is ordered most-frequent first, and frequency = brand presence). Use the first 3 most-frequent colors that look like real brand colors (skip near-grays). Do not invent hex values.
- For each product:
  - product_url: prefer JSON-LD "url=" from the hint block; otherwise the [LINK href=…] enclosing or nearest to the product's name/title. Use site-relative paths like /products/slug when full URL is not in the text. Never invent domains.
  - price_text: the primary customer-facing price string as shown (include currency symbols, "from", "/mo", ranges if that is how it appears)
  - price_currency: ISO 4217 code when explicit or obvious from symbol ($→USD unless page says CAD/AUD/etc.; £→GBP; €→EUR)
  - description: longer paragraph or spec block for that product when present; otherwise null
  - key_features: short bullet strings (materials, sizes, integrations, plan limits) when listed
  - image_url: pick the BEST product image, in this priority:
      1. The "image=" URL of the matching JSON-LD product (when names align)
      2. The nearest [IMG src=…] whose alt text or surrounding text matches the product name (prefer images that look like a product hero — avoid logos, banners, payment icons, social icons, hero/lifestyle photos with people)
      3. og:image only as a last resort and only when it clearly shows the same product
    Use absolute https when possible; otherwise null. Do not invent URLs.
- Tone and personality tags should be descriptive adjectives
- If information is not clearly present, use null rather than guessing URLs or prices`;

  const user = `Extract brand information from this website content:

${websiteContent.slice(0, 12000)}

${visualHintBlock}

Extract the brand name, description, category, positioning, value proposition, tone/personality, visual identity (including colors when you can justify them), and every product you can tie to concrete on-page evidence — especially PDP links, prices, hero images, feature bullets, and longer descriptions.`;

  return { system, user };
}
