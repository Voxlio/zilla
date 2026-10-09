// Fundamental data types

export interface CalendarEvent {
  time: number; // Unix timestamp in seconds
  currency: string;
  impact: "high" | "medium" | "low";
  event: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  revised?: string;
}

export interface NewsHeadline {
  headline: string;
  source: string;
  time: number; // Unix timestamp in seconds
  url?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
}

export interface FundamentalData {
  calendar: CalendarEvent[];
  headlines: NewsHeadline[];
  score: number; // -100 to +100
  warnings: string[];
}

// Adapter interface for data sources
export interface CalendarAdapter {
  fetchThisWeek(): Promise<CalendarEvent[]>;
}

export interface NewsAdapter {
  fetchNews(): Promise<NewsHeadline[]>;
}

// Configuration for fundamental analysis
export interface FundamentalConfig {
  // Keywords for bullish/bearish sentiment
  bullishKeywords: string[];
  bearishKeywords: string[];
  
  // Impact weights
  highImpactWeight: number;
  mediumImpactWeight: number;
  lowImpactWeight: number;
  
  // Recency settings
  headlineMaxAgeHours: number;
  calendarLookaheadHours: number;
}

// Default configuration
export const defaultFundamentalConfig: FundamentalConfig = {
  bullishKeywords: [
    "rate cut", "dovish", "safe haven", "recession", "crisis", 
    "war", "geopolitical", "inflation cooling", "fed pivot", 
    "employment weak", "unemployment rise", "jobless claims up",
    "retail sales down", "manufacturing contraction", "gdp down",
    "consumer spending down", "housing starts down", "yield curve steepen"
  ],
  
  bearishKeywords: [
    "rate hike", "hawkish", "strong dollar", "yields rise", 
    "tightening", "strong economy", "soft landing", 
    "employment strong", "unemployment fall", "jobless claims down",
    "retail sales up", "manufacturing expansion", "gdp up",
    "consumer spending up", "housing starts up", "yield curve flatten",
    "inflation hot", "core inflation up", "wage growth up"
  ],
  
  highImpactWeight: 90,
  mediumImpactWeight: 70,
  lowImpactWeight: 50,
  
  headlineMaxAgeHours: 48,
  calendarLookaheadHours: 4,
};