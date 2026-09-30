/**
 * Cheap deterministic pass over every message. Two jobs:
 *  1. Drop obvious noise so the LLM never sees it (saves most of the API cost).
 *  2. Hand strong hints to the LLM so it can be more accurate with Sinhala text.
 *
 * These keywords are only a pre-filter. The model prompt carries the real Sinhala
 * reading guide, so if a word is missed here the message is still understood —
 * it just costs an API call instead of being free.
 */

const TIME_HINTS =
  /(උදේ|බයම|නිල්|සවස|රාත්‍රී|රෑ|අද|හෙට|am|pm)/i;
const DATE_HINTS =
  /(අද|හෙට|තෙනසුම්|ලබන|අඟහරු|සැප්|ඉරිදා|බදාදා|මසකරු|තෙනසුම්|දින|today|tomorrow)/i;

const CLASS_HINTS =
  /(class|පාඩම|paper|පත්‍ර|revision|ශේෂ|theory|න්‍යාස|extra|අමතර|booster|program online|morning test|spot test|උදේ පරීක්ෂණ|test|පරීක්ෂණ|lecture|ශ්‍රතන|zoom|youtube|premiere|seminar|සම්මේලන|discussion)/i;

const POSTPONE_HINTS =
  /(postpone|දිගලා|තත්වයක්|වෙනුවට|reschedul|අලුත් දිනයක|නව දිනයක|cancel|අවලංගු|නොපවත්නා|පලමුවට|කලින් පටන් ගන්න|ආරම්භ වීමට)/i;

const LINK_HOSTS =
  /(zoom\.us|youtube\.com|youtu\.be|drive\.google|docs\.google|typeform|forms\.gle|t\.me\/[A-Za-z_])/i;

/** Messages that are never worth an LLM call. */
export function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s‍️]+$/u.test(t)) return true;
  if (t.length < 4 && !/\d/.test(t)) return true;
  return false;
}

export interface RuleHints {
  hasLink: boolean;
  hasZoom: boolean;
  hasYouTube: boolean;
  hasTime: boolean;
  hasDate: boolean;
  looksPostponed: boolean;
  looksLikeClass: boolean;
  likelyRelevant: boolean;
  sinhalaRatio: number;
}

/** Heuristic hints fed to the LLM, and used alone when no AI provider is set. */
export function ruleHints(text: string): RuleHints {
  const t = text;
  const sinhalaChars = (t.match(/[\u0D80-\u0DFF]/g) ?? []).length;
  const letters = (t.match(/[\p{L}]/gu) ?? []).length || 1;
  const hasZoom = /zoom\.us|\/j\/\d{9,}|webinar\/register/i.test(t);
  const hasYouTube = /youtube\.com|youtu\.be/i.test(t);
  const hasLink = LINK_HOSTS.test(t);
  const hasTime = TIME_HINTS.test(t);
  const hasDate = DATE_HINTS.test(t);
  const looksPostponed = POSTPONE_HINTS.test(t);
  const looksLikeClass = CLASS_HINTS.test(t);
  const substantial = t.length > 60;

  // Worth an API call when it looks schedule-bearing and names a day or time,
  // or when it is a long message that mentions a class at all.
  const likelyRelevant =
    (hasZoom || hasYouTube || hasLink || looksLikeClass || looksPostponed) &&
    (hasTime || hasDate || looksLikeClass || hasZoom || hasYouTube)
      ? true
      : substantial && (looksLikeClass || hasDate || hasTime || hasZoom || hasYouTube);

  return {
    hasLink,
    hasZoom,
    hasYouTube,
    hasTime,
    hasDate,
    looksPostponed,
    looksLikeClass,
    likelyRelevant,
    sinhalaRatio: sinhalaChars / letters,
  };
}

/** How many pages of history to pull on a cold backfill. */
export function backfillDepth(days: number): number {
  if (days <= 3) return 1;
  if (days <= 10) return 3;
  if (days <= 30) return 8;
  return 20;
}

export const RELEVANCE_THRESHOLD = 0.35;
