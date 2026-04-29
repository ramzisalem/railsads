import type {
  BrandContext,
  CompetitorReferenceAd,
  IcpContext,
  ProductContext,
  TemplateContext,
} from "./prompts";

/**
 * Inputs we may inject into the gpt-image-1 prompt as a deterministic suffix.
 *
 * Why this exists: the text creative LLM that writes `image_prompt` is told
 * about brand colors, audience, angle, and awareness — but it's free to drop
 * any of them when summarising into one sentence. By the time `gpt-image-1`
 * sees the prompt, audience persona / angle / awareness / brand rules are
 * usually missing entirely, so generated ads look generically cheerful even
 * when the brief specified something edgier or pain-focused.
 *
 * We restate every signal we have, in role-tagged form, so the image model
 * gets a hard anchor for: product specifics, brand colors + personality +
 * style + rules, audience, narrative angle, viewer awareness, output medium,
 * and a universal "what to avoid" footer — in addition to whatever the LLM
 * produced.
 */
export interface ImagePromptSuffixInputs {
  brand: BrandContext;
  product?: ProductContext | null;
  icp?: IcpContext | null;
  angle?: string | null;
  awareness?: string | null;
  /** Visual style preset selected on the thread (see `lib/studio/visual-styles.ts`).
   *  When set, we restate the curated style fragment as a hard aesthetic
   *  anchor for gpt-image-1 — the upstream LLM also bakes it into image_prompt,
   *  but reinforcement helps the image model stay on style. */
  visualStyle?: { label: string; prompt: string } | null;
  /** Output size, used to derive composition/aspect-ratio guidance. */
  size?: "1024x1024" | "1536x1024" | "1024x1536" | null;
  /**
   * The creative_direction string from the latest assistant message in the
   * thread. Already considers brand + audience + angle + awareness, so it's a
   * strong, pre-distilled visual brief written by the same LLM that produced
   * the `image_prompt`.
   */
  creativeDirection?: string | null;
  /**
   * When true, strengthen "preserve the reference image" wording. Used by
   * /api/image/edit where we always pass the previous version as a reference
   * and want minimal divergence beyond the user's instruction.
   */
  preserveReference?: boolean;
  /**
   * A competitor ad pinned to the thread. When set, the first reference
   * image passed to gpt-image-1 is the competitor screenshot — we tell the
   * model to mirror its composition / energy without copying any of its
   * brand-owned assets, claims, or text.
   */
  referenceAd?: CompetitorReferenceAd | null;
  /**
   * A pinned ad template (visual layout). When set, the template thumbnail
   * is also passed to gpt-image-1 as a reference and we tell the model to
   * adopt the template's structure (panels, hierarchy, callout positions).
   */
  template?: TemplateContext | null;
}

const AWARENESS_GUIDANCE: Record<string, string> = {
  unaware:
    "viewer is UNAWARE of the problem — open with a curious, surprising, attention-stopping visual; emphasize an emotional state or unexpected detail rather than the product",
  problem_aware:
    "viewer is PROBLEM-AWARE — show the problem itself in a relatable, empathetic moment; product can appear as the relief but should not dominate",
  solution_aware:
    "viewer is SOLUTION-AWARE — feature the product as the obvious solution, with one concrete benefit visualised (e.g. before/after, ingredient highlight, in-use demonstration)",
  product_aware:
    "viewer is PRODUCT-AWARE — make the product the hero; lean on packaging, badges, proof points, and trust signals",
  most_aware:
    "viewer is MOST-AWARE — push offer-led visuals: price, discount, urgency badges, packshot prominent and ready-to-buy",
};

const ANGLE_GUIDANCE: Record<string, string> = {
  "problem-focused":
    "lead with the pain or friction the audience feels; the product should appear as relief, not the centerpiece",
  "benefit-focused":
    "show the transformation or outcome the product delivers; emphasize the post-product life",
  transformation:
    "depict a clear before/after; either explicit split-frame or strong implied contrast in mood, colors, or environment",
  "before / after":
    "use an explicit split-frame composition with the 'before' on one side and the 'after' on the other",
  "social proof":
    "include human testimonial cues — relatable real-feeling person, expression of satisfaction, optional quote bubble or star rating",
  urgency:
    "use scarcity / limited-time visual cues: countdown badge, 'today only' callout, bold CTA button",
  curiosity:
    "withhold the obvious hero shot; tease with an unusual crop, unexpected element, or visual question that pulls the eye",
};

// Per-format guidance. The TEXT-SAFE AREA insets are critical: gpt-image-1
// will otherwise crop on-image headlines flush against the frame, clipping
// descenders ("g", "y", "p") or whole lines. Insets are expressed as % of
// canvas height (top/bottom) and width (left/right) so the model has a
// concrete target rather than vague "padding".
const FORMAT_GUIDANCE: Record<string, string> = {
  "1024x1024":
    "OUTPUT FORMAT — square 1:1 ad creative for Meta / Instagram feed. Center the subject, leave breathing room on all sides for cropping safety, keep all visual elements (subject, product, badges) within the inner 80% to survive feed cropping. TEXT-SAFE AREA: any on-image ad copy must sit inside an inset of at least 8% from the top, 8% from the bottom, and 6% from each side — measured to the OUTER bounding box of the text (including descenders and any background scrim/pill).",
  "1536x1024":
    "OUTPUT FORMAT — landscape 16:9 ad creative for Facebook feed banner / YouTube. Use horizontal composition with the subject anchored left or right of center; leave a clean copy area (negative space) on the opposite side for headline overlay if needed. TEXT-SAFE AREA: any on-image ad copy must sit inside an inset of at least 8% from the top, 8% from the bottom, and 6% from each side — measured to the OUTER bounding box of the text (including descenders and any background scrim/pill).",
  "1024x1536":
    "OUTPUT FORMAT — vertical 9:16 ad creative for Instagram Stories / Reels / TikTok. Stack composition top-to-bottom; keep the hook visual in the upper third (above the fold), product in the middle third, leave bottom 20% safe-zone clear for app UI overlays. TEXT-SAFE AREA: any on-image ad copy must sit inside an inset of at least 10% from the top, 18% from the bottom (the lower 18% is reserved for app UI), and 6% from each side — measured to the OUTER bounding box of the text (including descenders and any background scrim/pill).",
};

/**
 * Builds the deterministic suffix appended to every image-generation /
 * image-edit prompt. Keep each section short and role-tagged so gpt-image-1
 * can use it without burning the prompt budget.
 */
export function buildImagePromptSuffix(
  inputs: ImagePromptSuffixInputs
): string {
  const {
    brand,
    product,
    icp,
    angle,
    awareness,
    visualStyle,
    size,
    creativeDirection,
    preserveReference,
    referenceAd,
    template,
  } = inputs;
  const sections: string[] = [];

  // ---- PRODUCT ----------------------------------------------------------
  // Tells the model what the thing actually IS (form factor, category) so it
  // can place it correctly in the scene. Without this, gpt-image-1 sometimes
  // shows the wrong vessel (e.g. a tube instead of a bottle).
  if (product) {
    const productLines: string[] = [`PRODUCT — ${product.name}`];
    if (product.short_description) {
      productLines.push(`What it is: ${product.short_description}`);
    }
    if (product.price) {
      productLines.push(`Price (only render on-image if angle calls for it): ${product.price}`);
    }
    sections.push(productLines.join("\n"));
  }

  // ---- BRAND COLORS ----------------------------------------------------
  const palette: { segment: string; hex: string }[] = [];
  if (brand.color_palette && brand.color_palette.length > 0) {
    palette.push(...brand.color_palette);
  } else {
    if (brand.primary_color)
      palette.push({ segment: "primary", hex: brand.primary_color });
    if (brand.secondary_color)
      palette.push({ segment: "secondary", hex: brand.secondary_color });
    if (brand.accent_color)
      palette.push({ segment: "accent", hex: brand.accent_color });
  }
  if (palette.length > 0) {
    const colorLines = [
      `BRAND COLORS — use these exact hex values for any background washes, badges, callout shapes, accent strokes, on-image typography, and CTA elements (do NOT introduce off-brand colors):`,
    ];
    for (const c of palette) colorLines.push(`- ${c.segment}: ${c.hex}`);
    sections.push(colorLines.join("\n"));
  }

  // ---- BRAND PERSONALITY + STYLE --------------------------------------
  // Tone + personality tags translate directly to visual mood (e.g.
  // "playful" → bright + rounded shapes, "scientific" → clean + precise).
  const styleLines: string[] = [];
  if (brand.style_tags.length > 0) {
    styleLines.push(`Visual style: ${brand.style_tags.join(", ")}`);
  }
  if (brand.tone_tags.length > 0) {
    styleLines.push(`Tone of voice (mirror in mood, lighting, expressions): ${brand.tone_tags.join(", ")}`);
  }
  if (brand.personality_tags.length > 0) {
    styleLines.push(`Brand personality: ${brand.personality_tags.join(", ")}`);
  }
  if (styleLines.length > 0) {
    sections.push(`BRAND STYLE & PERSONALITY\n${styleLines.join("\n")}`);
  }

  // ---- BRAND DO / DON'T RULES ----------------------------------------
  // These are explicit guardrails the brand has set; they should be hard
  // constraints in the imagery (e.g. "never show medical iconography").
  if (brand.do_rules.length > 0 || brand.dont_rules.length > 0) {
    const ruleLines: string[] = [];
    if (brand.do_rules.length > 0) {
      ruleLines.push(`DO: ${brand.do_rules.join("; ")}`);
    }
    if (brand.dont_rules.length > 0) {
      ruleLines.push(`DON'T: ${brand.dont_rules.join("; ")}`);
    }
    sections.push(`BRAND RULES (hard constraints)\n${ruleLines.join("\n")}`);
  }

  // ---- AUDIENCE (ICP) ------------------------------------------------
  if (icp) {
    const audienceLines: string[] = [
      `TARGET AUDIENCE — the person in the image (or implied viewer) should clearly be: ${icp.title}.`,
    ];
    if (icp.summary) audienceLines.push(`Persona: ${icp.summary}`);
    if (icp.pains.length > 0) {
      audienceLines.push(
        `Top pains to evoke (visually or via context, not text): ${icp.pains
          .slice(0, 2)
          .join("; ")}`
      );
    }
    if (icp.desires.length > 0) {
      audienceLines.push(
        `Top desires to suggest in the outcome shown: ${icp.desires
          .slice(0, 2)
          .join("; ")}`
      );
    }
    sections.push(audienceLines.join("\n"));
  }

  // ---- ANGLE ---------------------------------------------------------
  if (angle) {
    const key = angle.trim().toLowerCase();
    const directive = ANGLE_GUIDANCE[key];
    sections.push(
      directive
        ? `NARRATIVE ANGLE — "${angle}": ${directive}.`
        : `NARRATIVE ANGLE — "${angle}".`
    );
  }

  // ---- AWARENESS -----------------------------------------------------
  if (awareness) {
    const key = awareness.trim().toLowerCase();
    const directive = AWARENESS_GUIDANCE[key];
    sections.push(
      directive
        ? `AWARENESS LEVEL — ${directive}.`
        : `AWARENESS LEVEL — "${awareness}".`
    );
  }

  // ---- VISUAL STYLE PRESET ------------------------------------------
  // The user explicitly chose this aesthetic in the Studio context panel.
  // It sits alongside (and outranks) brand `style_tags` for this thread —
  // `style_tags` describe the brand's evergreen identity, `visualStyle` is
  // the per-thread direction the user wants right now.
  if (visualStyle) {
    sections.push(
      [
        `VISUAL STYLE — "${visualStyle.label}" (per-thread aesthetic chosen by the user; outranks generic brand style tags for this generation).`,
        visualStyle.prompt,
        `Brand colors, product packaging fidelity, and on-image text legibility still take priority — the style sets the aesthetic, not the subject.`,
      ].join("\n")
    );
  }

  // ---- CREATIVE DIRECTION (designer brief from upstream LLM) --------
  // The text-LLM already produced a designer-ready brief that considers
  // brand + audience + angle + awareness. Restating it gives gpt-image-1 a
  // pre-distilled, on-strategy visual concept to anchor on.
  if (creativeDirection && creativeDirection.trim().length > 0) {
    sections.push(
      `CREATIVE DIRECTION (designer brief) — ${creativeDirection.trim()}`
    );
  }

  // ---- COMPETITOR REFERENCE (inspiration only) ---------------------
  // The competitor screenshot is the FIRST reference image (see route).
  // Tell the model to lift composition / energy but never copy logos,
  // packaging, claims, or pricing from it.
  if (referenceAd?.image_url) {
    const refLines: string[] = [
      `COMPETITOR REFERENCE — the FIRST attached reference image is a competitor ad from ${referenceAd.competitor_name}. It is INSPIRATION ONLY: mirror its composition, layout, framing, energy, and color rhythm. Do NOT copy its logos, packaging, brand marks, claims, badges, on-image copy, or pricing. The product, palette, typography, and messaging in our output must be OURS (governed by the BRAND COLORS, BRAND STYLE, and PRODUCT sections above).`,
    ];
    if (referenceAd.title) {
      refLines.push(`Reference title (for context): ${referenceAd.title}`);
    }
    sections.push(refLines.join("\n"));
  }

  // ---- TEMPLATE LAYOUT REFERENCE -----------------------------------
  // The template thumbnail is added to the references list right after the
  // competitor reference (see route). It is a STRUCTURAL anchor — adopt the
  // panels / hierarchy / callout positioning, but render OUR product, copy,
  // and palette. Never copy any text, badges, faces, or branding from the
  // template thumbnail (those are placeholders).
  if (template?.thumbnail_url) {
    const templateLines: string[] = [
      `TEMPLATE LAYOUT — one of the attached reference images shows the "${template.name}" template. Use it as a STRUCTURAL anchor: adopt the same composition, panel arrangement, headline / callout / product positioning, and visual rhythm.`,
      `Do NOT copy any text, faces, products, branding, badges, or stock content from the template thumbnail — those are placeholders. Replace every element with OUR product, OUR copy (the quoted strings in this prompt), and the BRAND COLORS palette above.`,
    ];
    if (template.layout) {
      templateLines.push(`Layout brief: ${template.layout}`);
    }
    sections.push(templateLines.join("\n"));
  }

  // ---- OUTPUT FORMAT / MEDIUM ---------------------------------------
  if (size && FORMAT_GUIDANCE[size]) {
    sections.push(FORMAT_GUIDANCE[size]);
  }

  // ---- PRODUCT PRESERVATION -----------------------------------------
  // gpt-image-1 will re-render packaging text from scratch unless told very
  // explicitly not to. We list every visual element to lock down (text,
  // typography, badges, illustrations) and demand verbatim reproduction. The
  // SDK is also called with `input_fidelity: "high"`; the prompt-side rule
  // reinforces what that flag enables.
  if (brand.name) {
    // Build the exclude clause based on which non-product reference slots
    // are populated (competitor screenshot, template layout). Those refs
    // are STRUCTURAL — NOT the canonical packaging — so the model must not
    // copy product text from them.
    const excluded: string[] = [];
    if (referenceAd?.image_url) excluded.push("competitor reference");
    if (template?.thumbnail_url) excluded.push("template layout reference");
    const productRefClause =
      excluded.length > 0
        ? `treat the OTHER reference image(s) (everything EXCEPT the ${excluded.join(" and the ")}) as the canonical ${brand.name} packaging`
        : `treat the reference image(s) as the canonical ${brand.name} packaging`;
    const baseRule = preserveReference
      ? `PRODUCT PACKAGING — the reference image IS the product. Preserve packaging shape, proportions, label colors, illustrations, photography, and ALL packaging text exactly as shown. Only change what the edit instruction requests.`
      : `PRODUCT PACKAGING — ${productRefClause}. Preserve packaging shape, proportions, label colors, illustrations, photography, and ALL packaging text exactly as shown. The product itself must look identical to the reference; you may only place it in a new scene.`;

    const fidelityRules = [
      baseRule,
      `TEXT FIDELITY — do NOT re-letter, re-typeset, re-translate, paraphrase, abbreviate, or invent any words on the product. Reproduce every label string (brand name, product name, flavor, descriptors, ingredient lines, badges, certifications, dosage, weight, fine print) character-for-character with the same fonts, weights, kerning, and color as the reference. If you cannot render a string clearly, CROP or ANGLE the packaging so the unreadable area falls outside the frame — never substitute fake words.`,
      `NO INVENTED ELEMENTS — do NOT add new badges, seals, sub-brand names, claims, certifications, or call-outs that are not on the reference packaging.`,
    ];
    if (preserveReference) {
      fidelityRules.push(
        `ON-IMAGE AD COPY PRESERVATION — if the reference image already has ad copy overlaid on the scene (a headline, a hook, a CTA), preserve those overlays EXACTLY: same wording, same position, same font, same color, same effects. Only modify them if the edit instruction explicitly names that text element (e.g. "change the headline to …", "remove the CTA", "move the hook to the bottom"). Otherwise, treat them as locked layout.`
      );
    }
    sections.push(fidelityRules.join("\n"));
  }

  // ---- ON-IMAGE AD COPY (HEADLINE + HOOK) ----------------------------
  // The upstream creative LLM bakes the chosen hook + headline into
  // `image_prompt` as quoted strings with explicit position + typography.
  // gpt-image-1 still tends to paraphrase / misspell on-image text unless
  // we restate the verbatim-rendering contract here, separately from the
  // packaging-text rule (which is enforced elsewhere via the reference image).
  sections.push(
    [
      `ON-IMAGE AD COPY — the prompt above contains ad copy in double quotes (the ad's hook and headline). RENDER each quoted string EXACTLY as written, character-for-character, including punctuation and casing. No paraphrasing, no abbreviation, no pluralization, no autocorrect, no translation.`,
      `Place each string at the position specified in the prompt. Use a clean, bold sans-serif unless the prompt names a specific style. Choose a color drawn from the BRAND COLORS palette above. Ensure HIGH CONTRAST against the area behind it (add a subtle scrim, gradient, or soft shadow if needed for legibility).`,
      `NO TEXT CLIPPING — every glyph, including descenders ("g", "y", "p", "j", "q") and the LAST line of multi-line text, MUST be fully inside the canvas with the TEXT-SAFE AREA inset specified in the OUTPUT FORMAT section. Before rendering, measure the full bounding box of every text element (top of the highest ascender to the bottom of the lowest descender, plus any scrim/background pill). If that bounding box would touch or cross the canvas edge, you MUST do ONE of the following — in this order of preference: (a) shrink the type size, (b) reflow to fewer lines, (c) move the block toward the canvas center. Do NOT crop, fade, or let any glyph bleed off the frame.`,
      `If a quoted string is too long to render legibly at the requested position, REDUCE the surrounding scene complexity (simplify background, increase negative space) rather than truncating, paraphrasing, or shrinking the text into illegibility.`,
      `Render NO additional ad copy beyond the quoted strings — do not invent extra taglines, badges, CTAs, or callouts unless the prompt explicitly names them.`,
    ].join("\n")
  );

  // ---- QUALITY BAR + UNIVERSAL NEGATIVE CONSTRAINTS ------------------
  // These hold for every ad we ship. Putting them last leaves them fresh in
  // the model's attention window without crowding earlier sections.
  sections.push(
    [
      `QUALITY BAR — advertising-grade output: sharp focus, professional studio-quality lighting, clean composition, no JPEG artifacts, no watermarks, no stock-photo feel.`,
      `AVOID — do NOT include: gibberish or misspelled text on packaging, badges, or ad copy overlays; invented brand or sub-brand names; competitor products or logos; off-brand colors; medical or pharmaceutical iconography unless explicitly requested; deformed hands, faces, or product proportions; placeholder elements (Lorem Ipsum, "Your Logo Here").`,
    ].join("\n")
  );

  return sections.join("\n\n");
}
