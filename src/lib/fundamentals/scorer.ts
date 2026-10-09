import { 
  CalendarEvent, 
  NewsHeadline, 
  FundamentalData, 
  FundamentalConfig, 
  defaultFundamentalConfig,
  CalendarAdapter,
  NewsAdapter,
} from "./types";

/**
 * How the two halves of the fundamental score are bounded.
 *
 * The calendar half and the headline half are measured in completely different
 * units, so each is clamped to its own budget before they are added. That stops
 * one noisy news cycle, or one freak data print, from pegging the whole score.
 */
const CALENDAR_SCORE_MAX = 60;
const HEADLINE_SCORE_MAX = 40;

/**
 * A surprise this large (as a fraction of the forecast) counts as "about as big
 * as surprises get" and earns close to the event's full weight. 0.10 means a
 * 10% miss or beat is already a strong signal.
 *
 * This is a chosen default, not a figure derived from historical data. It is
 * the main knob for how twitchy the calendar half of the score is.
 */
const SURPRISE_SATURATION = 0.1;

/**
 * Parse a value as it appears on an economic calendar into a plain number.
 *
 * Calendars write numbers in human form: "3.2%", "150K", "1.2M", "-0.4",
 * "1,250", "(0.3)". `parseFloat` alone silently drops the suffix, which makes
 * "150K" and "150" look identical and lets a thousands-scale release be
 * compared against a percentage.
 *
 * @param raw Value from the calendar feed
 * @returns The number, or null if there is nothing numeric to read
 */
export function parseEconomicValue(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;

  let text = String(raw).trim();
  if (text === "" || text === "-" || text === "--" || text === "n/a" || text === "N/A") {
    return null;
  }

  // "(0.3)" is accountancy notation for negative
  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }

  // Strip thousands separators, percent signs and stray currency symbols
  const cleaned = text.replace(/,/g, "").replace(/%/g, "").replace(/[$€£¥]/g, "").trim();

  const match = cleaned.match(/^([+-]?\d*\.?\d+)\s*([KMBT])?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!isFinite(value)) return null;

  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const multiplier = match[2] ? multipliers[match[2].toUpperCase()] : 1;

  return sign * value * multiplier;
}

/**
 * Score fundamental data to produce a fundamental bias score
 * @param calendar Economic calendar events
 * @param headlines News headlines
 * @param config Configuration for scoring
 * @returns Fundamental data with score and warnings
 */
export function scoreFundamentals(
  calendar: CalendarEvent[],
  headlines: NewsHeadline[],
  config: FundamentalConfig = defaultFundamentalConfig
): FundamentalData {
  const warnings: string[] = [];

  // Each half is clamped to its own budget so they stay comparable
  const calendarScore = clamp(
    scoreCalendarEvents(calendar, config),
    -CALENDAR_SCORE_MAX,
    CALENDAR_SCORE_MAX
  );
  const headlineScore = clamp(
    scoreHeadlines(headlines, config),
    -HEADLINE_SCORE_MAX,
    HEADLINE_SCORE_MAX
  );

  const score = calendarScore + headlineScore;

  // Check for upcoming high-impact events
  warnings.push(...checkUpcomingEvents(calendar, config));

  // Clamp score to -100 to +100 range
  const finalScore = clamp(Math.round(score), -100, 100);

  return {
    calendar,
    headlines,
    score: finalScore,
    warnings,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Events where a stronger-than-forecast print lifts the dollar, which weighs on
// gold. A beat is therefore bearish for gold.
const USD_POSITIVE_EVENTS = [
  "CPI", "NFP", "Non-Farm", "Retail Sales", "Core CPI", "PPI",
  "ISM", "GDP", "Yields", "Fed Funds Rate", "Durable Goods",
];

// Events where a stronger-than-forecast print means a weaker economy, which
// supports gold. A beat is therefore bullish for gold.
const USD_NEGATIVE_EVENTS = [
  "Jobless Claims", "Unemployment Rate", "Continuing Claims",
];

/**
 * Decide which way a beat on this event pushes gold.
 *
 * Matching is by substring, and the lists overlap ("Unemployment Rate" contains
 * "Rate", "Core CPI" contains "CPI"), so the LONGEST match wins - the most
 * specific description of the event.
 *
 * @returns -1 if a beat is bearish for gold, +1 if bullish, 0 if unknown
 */
function goldDirectionOnBeat(eventName: string): -1 | 0 | 1 {
  let bestLength = 0;
  let direction: -1 | 0 | 1 = 0;

  for (const name of USD_POSITIVE_EVENTS) {
    if (eventName.includes(name) && name.length > bestLength) {
      bestLength = name.length;
      direction = -1;
    }
  }
  for (const name of USD_NEGATIVE_EVENTS) {
    if (eventName.includes(name) && name.length > bestLength) {
      bestLength = name.length;
      direction = 1;
    }
  }

  return direction;
}

/**
 * Score calendar events based on actual vs forecast.
 *
 * Two things matter and both were previously lost:
 *
 *  1. The SIGN of the surprise. A hot CPI and a cool CPI mean opposite things
 *     for gold, so the score has to be able to go either way.
 *  2. The SCALE. NFP is quoted in thousands of jobs and CPI in percent, so the
 *     raw difference between actual and forecast is not comparable across
 *     events. The surprise is therefore expressed as a fraction of the forecast
 *     and then run through a saturating curve.
 */
function scoreCalendarEvents(events: CalendarEvent[], config: FundamentalConfig): number {
  let score = 0;

  for (const event of events) {
    // Only score USD events as specified in requirements
    if (event.currency !== "USD") continue;

    const actual = parseEconomicValue(event.actual);
    const forecast = parseEconomicValue(event.forecast);

    // Both numbers are required. Without a forecast there is no surprise to
    // measure - comparing the actual against 0 would invent an enormous one.
    if (actual === null || forecast === null) continue;

    // Which way does a beat push gold for this event?
    const directionOnBeat = goldDirectionOnBeat(event.event);
    if (directionOnBeat === 0) continue;

    // Relative surprise, so percent-scale and thousands-scale events compare.
    // A zero forecast has no meaningful relative scale, so fall back to the
    // absolute difference rather than dividing by zero.
    const denominator = Math.abs(forecast);
    const rawSurprise = denominator > 0 ? (actual - forecast) / denominator : actual - forecast;

    // Saturating curve: keeps the sign, caps the magnitude at 1, and lets a
    // moderate surprise still register instead of rounding away to nothing.
    const normalized = Math.tanh(rawSurprise / SURPRISE_SATURATION);

    // Determine impact weight
    let weight = config.lowImpactWeight;
    if (event.impact === "high") weight = config.highImpactWeight;
    else if (event.impact === "medium") weight = config.mediumImpactWeight;

    score += directionOnBeat * normalized * (weight / 100) * CALENDAR_SCORE_MAX;
  }

  return score;
}

/**
 * Score headlines based on keyword sentiment
 */
function scoreHeadlines(headlines: NewsHeadline[], config: FundamentalConfig): number {
  let score = 0;
  const now = Date.now() / 1000; // Current time in seconds
  const maxAgeSeconds = config.headlineMaxAgeHours * 3600;

  for (const headline of headlines) {
    // Skip old headlines
    const ageSeconds = now - headline.time;
    if (ageSeconds > maxAgeSeconds) continue;

    // Recency weighting: newer headlines have more weight
    const recencyWeight = Math.max(0.2, 1 - ageSeconds / maxAgeSeconds);
    
    const text = headline.headline.toLowerCase();
    let headlineScore = 0;

    // Check for bullish keywords
    for (const keyword of config.bullishKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        headlineScore += 1 * recencyWeight;
      }
    }

    // Check for bearish keywords
    for (const keyword of config.bearishKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        headlineScore -= 1 * recencyWeight;
      }
    }

    score += headlineScore;
  }

  return score;
}

/**
 * Check for upcoming high-impact events and generate warnings
 */
function checkUpcomingEvents(events: CalendarEvent[], config: FundamentalConfig): string[] {
  const warnings: string[] = [];
  const now = Date.now() / 1000;
  const lookaheadSeconds = config.calendarLookaheadHours * 3600;

  const upcomingHighImpact = events.filter(e => 
    e.impact === "high" && 
    e.time > now && 
    e.time < now + lookaheadSeconds &&
    e.currency === "USD"
  );

  if (upcomingHighImpact.length > 0) {
    const eventList = upcomingHighImpact.map(e => e.event).join(", ");
    warnings.push(`${upcomingHighImpact.length} high-impact USD event(s) within ${config.calendarLookaheadHours} hours: ${eventList}`);
  }

  return warnings;
}

/**
 * Default adapter for faireconomy.media calendar
 */
export class FaireconomyMediaCalendarAdapter implements CalendarAdapter {
  private cache: CalendarEvent[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  async fetchThisWeek(): Promise<CalendarEvent[]> {
    // Check cache
    if (this.cache && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION_MS) {
      return this.cache;
    }

    try {
      const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }
      
      const data: any[] = await response.json();
      const events: CalendarEvent[] = data
        .filter((item: any) => item.currency === "USD") // Only USD events
        .map((item: any) => ({
          time: Math.floor(new Date(item.date).getTime() / 1000),
          currency: item.currency,
          impact: item.impact as "high" | "medium" | "low",
          event: item.event,
          actual: item.actual || "",
          forecast: item.forecast || "",
          previous: item.previous || "",
        }));

      this.cache = events;
      this.cacheTimestamp = Date.now();
      return events;
    } catch (error) {
      console.error("Error fetching faireconomy.media calendar:", error);
      // Return empty array on error - graceful degradation
      return [];
    }
  }
}

/**
 * Default adapter for Finnhub news (placeholder - would need API key)
 */
export class FinnhubNewsAdapter implements NewsAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchNews(): Promise<NewsHeadline[]> {
    try {
      // This would be implemented with actual Finnhub API call
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error("Error fetching Finnhub news:", error);
      return [];
    }
  }
}

/**
 * Default adapter for NewsAPI (placeholder - would need API key)
 */
export class NewsApiAdapter implements NewsAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchNews(): Promise<NewsHeadline[]> {
    try {
      // This would be implemented with actual NewsAPI call
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error("Error fetching NewsAPI news:", error);
      return [];
    }
  }
}