import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Dimension weights and scoring for data & AI consultancies ───────────────
export const ANALYSIS_DIMENSIONS = [
  "technical_depth",
  "ai_ml_capabilities",
  "data_engineering",
  "industry_expertise",
  "talent_quality",
  "delivery_methodology",
  "innovation_rd",
  "client_portfolio",
  "commercial_model",
  "scalability",
  "ethics_governance",
  "tooling_partnerships",
] as const;

export type AnalysisDimension = (typeof ANALYSIS_DIMENSIONS)[number];

export interface ConsultancyProfile {
  name: string;
  description?: string;
  founded?: number;
  headcount?: number;
  headquarters?: string;
  geographies?: string[];
  industries?: string[];
  services?: string[];
  technologies?: string[];
  notable_clients?: string[];
  certifications?: string[];
  case_studies?: string[];
  pricing_model?: string;
  partnerships?: string[];
  awards?: string[];
  research_publications?: string[];
  additional_info?: string;
}

export interface DimensionScore {
  dimension: AnalysisDimension;
  label: string;
  score: number; // 1–10
  strengths: string[];
  weaknesses: string[];
  evidence: string;
}

export interface ConsultancyAnalysis {
  consultancy: string;
  executive_summary: string;
  overall_score: number;
  dimensions: DimensionScore[];
  key_strengths: string[];
  key_weaknesses: string[];
  opportunities: string[];
  threats: string[];
  ideal_client_profile: string;
  competitive_positioning: string;
  recommendation: string;
}

export interface ComparisonResult {
  consultancies: string[];
  summary: string;
  dimension_comparison: {
    dimension: string;
    label: string;
    scores: Record<string, number>;
    winner: string;
    insight: string;
  }[];
  overall_ranking: { name: string; score: number; rationale: string }[];
  best_for: Record<string, string>;
  recommendation: string;
}

const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  technical_depth: "Technical Depth & Breadth",
  ai_ml_capabilities: "AI/ML Capabilities",
  data_engineering: "Data Engineering & Infrastructure",
  industry_expertise: "Industry / Domain Expertise",
  talent_quality: "Talent Quality & Thought Leadership",
  delivery_methodology: "Delivery Methodology & Speed-to-Value",
  innovation_rd: "Innovation & R&D Investment",
  client_portfolio: "Client Portfolio & Track Record",
  commercial_model: "Commercial Model & Flexibility",
  scalability: "Scalability & Geographic Reach",
  ethics_governance: "AI Ethics & Data Governance",
  tooling_partnerships: "Tooling Stack & Ecosystem Partnerships",
};

// ─── Analyze a single consultancy ────────────────────────────────────────────
export async function analyzeConsultancy(
  profile: ConsultancyProfile
): Promise<ConsultancyAnalysis> {
  const profileText = JSON.stringify(profile, null, 2);

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: `You are a senior analyst specializing in evaluating data and AI consultancies.
Your role is to produce rigorous, evidence-based assessments of consultancy strengths and weaknesses.
Analyze each consultancy across 12 key dimensions critical for data & AI engagements.
Be specific, critical, and balanced — avoid generic praise. Back every claim with evidence from the profile.
Return your analysis as valid JSON matching the ConsultancyAnalysis schema exactly.`,
    messages: [
      {
        role: "user",
        content: `Analyze this data & AI consultancy and return a JSON object (no markdown, raw JSON only) with this exact structure:

{
  "consultancy": "<name>",
  "executive_summary": "<2-3 sentence overview>",
  "overall_score": <1-10 float>,
  "dimensions": [
    {
      "dimension": "<one of: ${ANALYSIS_DIMENSIONS.join(", ")}>",
      "label": "<human-readable label>",
      "score": <1-10>,
      "strengths": ["<specific strength>", ...],
      "weaknesses": ["<specific weakness>", ...],
      "evidence": "<what in the profile supports this score>"
    }
  ],
  "key_strengths": ["<top 3-5 strengths>"],
  "key_weaknesses": ["<top 3-5 weaknesses>"],
  "opportunities": ["<market/growth opportunities they are well-positioned for>"],
  "threats": ["<competitive/market threats>"],
  "ideal_client_profile": "<what types of clients/projects they are best suited for>",
  "competitive_positioning": "<how they differentiate in the market>",
  "recommendation": "<when to hire vs when to look elsewhere>"
}

Include ALL 12 dimensions: ${ANALYSIS_DIMENSIONS.join(", ")}

Consultancy profile:
${profileText}`,
      },
    ],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from analysis");
  }

  const raw = textBlock.text.trim();
  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json) as ConsultancyAnalysis;
}

// ─── Compare multiple consultancies ──────────────────────────────────────────
export async function compareConsultancies(
  profiles: ConsultancyProfile[]
): Promise<ComparisonResult> {
  const profilesText = JSON.stringify(profiles, null, 2);

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: `You are a senior analyst specializing in evaluating and comparing data and AI consultancies.
Produce a rigorous side-by-side comparison that helps clients choose the right partner.
Be specific and evidence-based. Return valid JSON only.`,
    messages: [
      {
        role: "user",
        content: `Compare these data & AI consultancies head-to-head and return a JSON object (raw JSON, no markdown) with this exact structure:

{
  "consultancies": ["<name1>", "<name2>", ...],
  "summary": "<2-3 sentence executive comparison>",
  "dimension_comparison": [
    {
      "dimension": "<dimension key>",
      "label": "<human-readable label>",
      "scores": { "<name1>": <score>, "<name2>": <score>, ... },
      "winner": "<name of strongest>",
      "insight": "<why this firm wins on this dimension>"
    }
  ],
  "overall_ranking": [
    { "name": "<firm name>", "score": <overall 1-10>, "rationale": "<why this rank>" }
  ],
  "best_for": {
    "large_enterprise": "<firm name + reason>",
    "mid_market": "<firm name + reason>",
    "startup": "<firm name + reason>",
    "regulated_industries": "<firm name + reason>",
    "cutting_edge_ai": "<firm name + reason>"
  },
  "recommendation": "<clear guidance on which to choose for what context>"
}

Score dimensions: ${ANALYSIS_DIMENSIONS.join(", ")}

Consultancy profiles:
${profilesText}`,
      },
    ],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from comparison");
  }

  const raw = textBlock.text.trim();
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json) as ComparisonResult;
}

// ─── Generate a full SWOT narrative report ───────────────────────────────────
export async function generateSwotReport(
  profile: ConsultancyProfile,
  context?: string
): Promise<string> {
  const profileText = JSON.stringify(profile, null, 2);

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    system: `You are a senior management consultant writing executive-level SWOT reports for data & AI consultancy evaluations.
Write in a clear, professional tone suitable for C-suite decision makers.
Be specific, actionable, and evidence-based. Structure the report clearly.`,
    messages: [
      {
        role: "user",
        content: `Write a detailed SWOT analysis report for this data & AI consultancy.

${context ? `Client context: ${context}\n` : ""}
Format the report as follows:
- Executive Summary (2-3 paragraphs)
- STRENGTHS (bullet points with explanation)
- WEAKNESSES (bullet points with explanation)
- OPPORTUNITIES (bullet points with forward-looking insight)
- THREATS (bullet points with competitive/market risks)
- Key Dimensions Deep-Dive (technical, talent, delivery, innovation)
- Verdict & Recommendation

Consultancy profile:
${profileText}`,
      },
    ],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from SWOT report");
  }

  return textBlock.text;
}

// ─── Score a consultancy from raw text description ────────────────────────────
export async function scoreFromText(rawText: string): Promise<ConsultancyAnalysis> {
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: `You are a senior analyst specializing in data and AI consultancies.
Extract structured information from unstructured text about a consultancy, then analyze it.
Return valid JSON only — no markdown, no explanation outside the JSON.`,
    messages: [
      {
        role: "user",
        content: `Analyze the following text about a data & AI consultancy. Extract all available information and produce a full analysis as a JSON object (raw JSON only) with this exact structure:

{
  "consultancy": "<extracted name>",
  "executive_summary": "<2-3 sentence overview>",
  "overall_score": <1-10 float>,
  "dimensions": [
    {
      "dimension": "<one of: ${ANALYSIS_DIMENSIONS.join(", ")}>",
      "label": "<human-readable label>",
      "score": <1-10>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "evidence": "<evidence from the text>"
    }
  ],
  "key_strengths": ["<top strengths>"],
  "key_weaknesses": ["<top weaknesses>"],
  "opportunities": ["<opportunities>"],
  "threats": ["<threats>"],
  "ideal_client_profile": "<ideal clients>",
  "competitive_positioning": "<market differentiation>",
  "recommendation": "<hiring guidance>"
}

Include ALL 12 dimensions: ${ANALYSIS_DIMENSIONS.join(", ")}
For any dimension with insufficient data, score conservatively (5/10) and note data gaps.

Text to analyze:
${rawText}`,
      },
    ],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from analysis");
  }

  const raw = textBlock.text.trim();
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json) as ConsultancyAnalysis;
}
