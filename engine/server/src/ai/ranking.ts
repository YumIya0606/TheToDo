import type { GatewayModel } from "./provider.js";

/**
 * Choosing a model that actually reads Sinhala.
 *
 * The free catalogues are full of models that are excellent at code and poor at
 * Sinhala, and picking the wrong one produces confidently wrong class times. So
 * rather than letting the student guess from a list, TheToDo ranks a
 * provider's free models by measured and observed Sinhala ability and picks the
 * best one automatically when a key is added.
 *
 * The order below reflects what this app has actually verified:
 *   1. Gemini Flash      — clearly the best free Sinhala reading; handled
 *                          "හෙට (සැප්. 29) උදේ 8.00" as 2026-09-29 08:00 correctly
 *   2. Qwen              — strong multilingual, solid weekday and time words
 *   3. Gemma             — good general multilingual, weaker on script nuance
 *   4. Mistral / Llama   — readable but loses nuance in Sinhala script
 *   5. everything else   — only used when nothing above exists
 */
/**
 * Ordered by observed Sinhala ability, not by reputation.
 *
 * The top entry is a Gemini Flash because it is clearly the best free reader
 * verified here: it turned "හෙට (සැප්. 29) උදේ 8.00" into 2026-09-29 08:00 and
 * read a tute, a question range and a booster episode out of one Sinhala post.
 *
 * Below that sit the families that are actually reachable on free tiers today.
 * These are not guesses: the names come from the catalogues of the free
 * endpoints this app talks to (Kilo, NVIDIA NIM, OpenRouter), so a match here
 * means the model can actually be called.
 */
interface Rule {
  match: RegExp;
  score: number;
  why: string;
}

const HIERARCHY: Rule[] = [
  { match: /gemini.*flash/i, score: 100, why: "Best free Sinhala reading" },
  { match: /gemini.*(pro|ultra)/i, score: 92, why: "Gemini, slower but strong" },
  // Qwen is the strongest non-Gemini multilingual family on the free tiers.
  { match: /qwen.*(flash|instruct|omni)/i, score: 88, why: "Strong multilingual" },
  { match: /^qwen/i, score: 86, why: "Strong multilingual" },
  // DeepSeek and GLM are current-generation and read Indic scripts well.
  { match: /deepseek.*(flash|v4|v3)/i, score: 84, why: "Current-generation, good Indic" },
  { match: /(glm|chatglm)/i, score: 80, why: "Good multilingual" },
  { match: /kimi|moonshot/i, score: 78, why: "Good multilingual" },
  // Built for Southeast Asian languages, which is exactly the gap Sinhala sits in.
  { match: /sea-?lion|aisingapore/i, score: 76, why: "Trained for Southeast Asian languages" },
  { match: /nemotron.*(super|ultra)/i, score: 74, why: "Reads Sinhala; verified here" },
  { match: /gemma.*(27|31)b/i, score: 70, why: "Decent multilingual" },
  { match: /mistral|nemo|ministral/i, score: 58, why: "Readable, weaker Sinhala" },
  { match: /llama.*(70|405)/i, score: 54, why: "General, limited Sinhala" },
  { match: /(nemotron.*nano|phi|granite|zamba|olmo)/i, score: 44, why: "Small, limited Sinhala" },
];

const DISQUALIFIERS: Array<{ match: RegExp; why: string }> = [
  { match: /(tts|image|vision|embedding|rerank|whisper|lyria|nano.?banana)/i, why: "not a text model" },
  { match: /(code|coder|search|tool|computer.?use|robot|research|transcribe)/i, why: "specialised" },
];

/**
 * Whether a model is free.
 *
 * Resellers that speak the OpenAI shape usually do not report pricing, so
 * assuming "free" is exactly what picks a paid model and then fails with
 * `402 Insufficient credits`. Instead, free is only claimed when the name says
 * so — a `:free` suffix, a `free/` prefix, or an explicit zero price — and
 * anything unrecognised is reported as unknown so the UI can say so honestly.
 */
export type FreeStatus = boolean | "unknown";

export function freeStatus(
  id: string,
  promptPerMillion?: number,
  completionPerMillion?: number,
): FreeStatus {
  if (/:free\b/i.test(id)) return true;
  if (/^free\//i.test(id)) return true;
  if (/(^|[/:-])free([/:-]|$)/i.test(id)) return true;
  if (promptPerMillion === 0 || completionPerMillion === 0) return true;
  if (promptPerMillion != null && promptPerMillion > 0) return false;
  return "unknown";
}

export interface RankedModel extends GatewayModel {
  score: number;
  why: string;
  free: FreeStatus;
}

/** Score one model id for Sinhala usefulness. Higher is better. */
export function scoreModel(id: string): { score: number; why: string } {
  for (const d of DISQUALIFIERS) {
    if (d.match.test(id) && d.why) return { score: -1, why: d.why };
  }
  let best = { score: 30, why: "no strong signal" };
  for (const rule of HIERARCHY) {
    if (rule.match.test(id) && rule.score > best.score) {
      best = { score: rule.score, why: rule.why };
    }
  }
  return best;
}

/** Rank a catalogue, best first. Free models outrank paid ones of equal quality. */
export function rankForSinhala(models: GatewayModel[]): RankedModel[] {
  return models
    .filter((m) => m.id && m.id.length > 0)
    .map((m) => {
      const { score, why } = scoreModel(m.id);
      return {
        ...m,
        score,
        why,
        free: freeStatus(m.id, m.promptPerMillion, m.completionPerMillion),
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => {
      // A known-free model always wins over an unknown-cost one, which in turn
      // wins over a known-paid one. Otherwise a reseller that hides its pricing
      // would get its paid flagship selected and then reject it with a 402.
      const rank = (m: RankedModel) => (m.free === true ? 0 : m.free === "unknown" ? 1 : 2);
      const byFree = rank(a) - rank(b);
      if (byFree !== 0) return byFree;
      if (b.score !== a.score) return b.score - a.score;
      return a.id.length - b.id.length || a.id.localeCompare(b.id);
    });
}

/**
 * The model TheToDo would pick from this catalogue. Prefers a known-free
 * option, and a `*-latest` alias, because that tracks the current release
 * instead of pinning a number that will eventually be retired.
 */
export function suggestModel(models: GatewayModel[]): RankedModel | null {
  const ranked = rankForSinhala(models);
  if (!ranked.length) return null;
  const best = ranked[0].score;
  // Stay within the top tier of quality, and of cost.
  const topCost = ranked[0].free;
  const contenders = ranked.filter((m) => m.score >= best - 2 && m.free === topCost);
  const latest = contenders.find((m) => /latest/i.test(m.id));
  return latest ?? contenders[0];
}

/**
 * The free equivalent of a model, when a provider offers both forms.
 *
 * Used to recover automatically from `402 Insufficient credits`: a caller
 * pointed at `gemini-3.8-flash` on a reseller that also publishes
 * `free/gemini-3.8-flash` gets moved onto the free one instead of failing.
 */
export function freeVariantOf(models: GatewayModel[], modelId: string): string | null {
  const target = modelId.replace(/^free\//i, "").replace(/:free$/i, "");
  const candidates = models.filter((m) => {
    if (freeStatus(m.id, m.promptPerMillion, m.completionPerMillion) !== true) return false;
    const bare = m.id.replace(/^free\//i, "").replace(/:free$/i, "");
    return bare === target;
  });
  if (!candidates.length) return null;
  // Prefer the shortest name, which is usually the plain `free/` form.
  candidates.sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));
  return candidates[0].id;
}
