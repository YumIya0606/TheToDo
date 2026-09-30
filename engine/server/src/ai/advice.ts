/**
 * Provider errors are HTTP status codes and gateway jargon. The student should
 * never have to read a 429 to know what to do next, so translate the known ones
 * into a concrete next step.
 */

export interface ProviderAdvice {
  headline: string;
  detail: string;
  action: string;
  severity: "blocker" | "warning";
}

const ADVICE: Array<{ test: RegExp; build: () => ProviderAdvice }> = [
  {
    test: /\b402\b|insufficient credit|insufficient balance|balance is empty|payment required|out of credit/i,
    build: () => ({
      headline: "That model is billed on this provider",
      detail:
        "The endpoint rejected the request for money, not for being busy. It often means the model selected is a paid one while the account is on a free plan — many resellers publish a paid and a free version of the same model side by side.",
      action:
        "TheToDo switches to the free version automatically when one exists, and remembers it. Press Try it on the connection to force it now.",
      severity: "warning",
    }),
  },
  {
    test: /invalid argument|model.*not found|no such model|unknown model/i,
    build: () => ({
      headline: "This provider does not recognise that model name",
      detail:
        "Resellers often rename models or require a provider prefix, so a name that works elsewhere is rejected here.",
      action: "Pick a model from this connection's own list in Settings → AI connections.",
      severity: "warning",
    }),
  },
  {
    test: /Quota exceeded for metric.*free_tier_requests|exceeded your current quota/i,
    build: () => ({
      headline: "Gemini's free daily quota is used up",
      detail:
        "Google gives the free tier a fixed number of requests per day per model, and today's budget is spent. It resets at midnight Pacific time. Nothing is lost — every message is kept and the queue works through the backlog on the next run.",
      action:
        "Press Sync again later today, or add a second provider (Kilo's free tier needs no key) and switch between them.",
      severity: "warning",
    }),
  },
  {
    test: /no longer available to new users/i,
    build: () => ({
      headline: "That Gemini model is retired for new keys",
      detail:
        "Google withdrew it for accounts created after a certain date, even though it still appears in the model list.",
      action:
        "Leave the model on TheToDo's default and it will move to the current Flash automatically. Or pick one from the live list in Settings.",
      severity: "warning",
    }),
  },
  {
    test: /currently experiencing high demand/i,
    build: () => ({
      headline: "The free Gemini tier is busy",
      detail:
        "Google's shared free Flash capacity is saturated right now. Requests are not being lost, just delayed.",
      action:
        "TheToDo retries the next model automatically. This usually clears within a few minutes.",
      severity: "warning",
    }),
  },
  {
    test: /free-models-per-day|unlock \d+ free model requests/i,
    build: () => ({
      headline: "OpenRouter free models need a small top-up",
      detail:
        "OpenRouter only serves :free models to accounts with some credit. Adding 10 USD once unlocks 1000 free requests a day, which is far more than this app will ever use.",
      action: "Add credit at openrouter.ai, or switch to Google Gemini which is free without payment details.",
      severity: "blocker",
    }),
  },
  {
    test: /\b402\b|payment required|insufficient_quota|out of credit/i,
    build: () => ({
      headline: "This provider needs credit",
      detail:
        "The model is not free on this plan, and the key has no credit left. Either add credit or pick a model marked free.",
      action: "Add credit, or choose a :free / free model in Settings → AI provider.",
      severity: "blocker",
    }),
  },
  {
    test: /\b429\b|rate limit/i,
    build: () => ({
      headline: "The free tier is rate limited",
      detail:
        "Free gateway models are shared and busy, so requests get throttled. TheToDo retries these automatically and picks them up on the next run — nothing is lost.",
      action: "Wait a few minutes and press Sync again, or use a model that is not on a shared free tier.",
      severity: "warning",
    }),
  },
  {
    test: /401|unauthorized|invalid.*key|authentication/i,
    build: () => ({
      headline: "That API key was not accepted",
      detail: "The provider rejected the key.",
      action: "Re-copy the key in Settings → AI provider and press Test.",
      severity: "blocker",
    }),
  },
  {
    test: /\b404\b|model.*unavailable/i,
    build: () => ({
      headline: "That model is not available right now",
      detail: "Free models come and go. The one selected is currently offline.",
      action: "Pick another model in the list in Settings → AI provider.",
      severity: "warning",
    }),
  },
  {
    test: /timed out|ETIMEDOUT|fetch failed|ECONNRESET/i,
    build: () => ({
      headline: "The provider stopped responding",
      detail: "The request took too long or the connection dropped.",
      action: "Try again, or switch to a faster model.",
      severity: "warning",
    }),
  },
  {
    test: /no json|returned an empty completion|no JSON object/i,
    build: () => ({
      headline: "The model did not return a usable answer",
      detail:
        "This usually means the model spent its whole budget reasoning instead of answering. TheToDo retries these on the next run.",
      action: "Try pinning a model that answers directly, such as google/gemini-2.5-flash.",
      severity: "warning",
    }),
  },
];

export function advise(rawError: string): ProviderAdvice {
  for (const rule of ADVICE) {
    if (rule.test.test(rawError)) return rule.build();
  }
  return {
    headline: "The AI provider had a problem",
    detail: rawError.slice(0, 300),
    action: "Check the key and model in Settings, then press Test.",
    severity: "warning",
  };
}
