// Core type definitions for Zilla analysis engine

export type Timeframe = "M15" | "H1" | "H4" | "D1";

export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleResponse {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  timestamp: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

export interface MarketStructure {
  swings: SwingPoint[];
  trend: "bullish" | "bearish" | "ranging";
  bos: BreakOfStructure[];
  choch: ChangeOfCharacter[];
  higherHighs: number[];
  higherLows: number[];
  lowerHighs: number[];
  lowerLows: number[];
}

export interface BreakOfStructure {
  index: number;
  time: number;
  price: number;
  direction: "bullish" | "bearish";
  type: "BOS";
}

export interface ChangeOfCharacter {
  index: number;
  time: number;
  price: number;
  direction: "bullish" | "bearish";
  type: "CHoCH";
}

export interface FVG {
  index: number;
  time: number;
  top: number;
  bottom: number;
  type: "bullish" | "bearish";
  mitigated: boolean;
  mitigationIndex?: number;
}

export interface LiquidityLevel {
  price: number;
  time: number;
  type: "buy-side" | "sell-side";
  source: "swing" | "intermediate" | "session";
  session?: "asia" | "london" | "ny";
  strength: number; // 0-1
  tested: boolean;
}

export interface SessionRange {
  session: "asia" | "london" | "ny";
  high: number;
  low: number;
  highTime: number;
  lowTime: number;
}

export interface PremiumDiscountZones {
  rangeHigh: number;
  rangeLow: number;
  premium: { top: number; bottom: number };
  equilibrium: number;
  discount: { top: number; bottom: number };
}

export interface Reason {
  category: "structure" | "fvg" | "liquidity" | "session" | "fundamental" | "premium-discount";
  label: string;
  value: string | number;
  direction: "bullish" | "bearish" | "neutral";
  weight: number; // 0-100
}

export type TradeDirection = "buy" | "sell";

export interface TradeIdea {
  id: string;
  timestamp: number;
  symbol: string;
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number; // 0-100
  reasons: Reason[];
  technicalScore: number; // -100 to +100
  fundamentalScore: number; // -100 to +100
  currentPrice: number;
  structure: MarketStructure;
  fvgs: FVG[];
  liquidity: LiquidityLevel[];
  sessions: SessionRange[];
  zones: PremiumDiscountZones;
  disclaimer: string;
}

export interface DailyThesis {
  badge: "bullish" | "bearish";
  title: string;
  summary: string;
}

export interface PriceActionSection {
  title: string;
  content: string;
}

export interface M15Breakdown {
  title: string;
  items: string[];
}

export interface LiquidityLevelsSection {
  buySide: LiquidityLevel[];
  sellSide: LiquidityLevel[];
}

export interface WhatToWatch {
  invalidationLevel: number;
  liquidityDraw: number;
  note?: string;
}

export interface AnalysisReport {
  dailyThesis: DailyThesis;
  currentPriceAction: PriceActionSection;
  m15Breakdown: M15Breakdown;
  liquidityLevels: LiquidityLevelsSection;
  whatToWatch: WhatToWatch;
  timestamp: string;
  price: number;
}

export interface WhyThisTrade {
  reason: string;
  weight: number;
  category: string;
}

export interface SimpleSummary {
  sentences: string[];
}

export interface FundamentalData {
  calendar: CalendarEvent[];
  headlines: NewsHeadline[];
  score: number; // -100 to +100
  warnings: string[];
}

export interface CalendarEvent {
  time: number;
  currency: string;
  impact: "high" | "medium" | "low";
  event: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

export interface NewsHeadline {
  headline: string;
  source: string;
  time: number;
  url?: string;
}

export interface AssetConfig {
  symbol: string;
  name: string;
  displayName: string;
  pipSize: number;
  contractSize: number;
  marginCurrency: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  timestamp: number;
  symbol: string;
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number;
  thesis: string;
  outcome?: "tp1" | "tp2" | "sl" | "pending" | "expired";
  outcomeR?: number;
  candlesChecked?: Candle[];
}

export interface ScorecardData {
  username: string;
  range: "7d" | "30d" | "90d";
  netR: number;
  closedTrades: number;
  winRate: number;
  avgR: number;
  bestR: number;
  equityCurve: number[];
  mascotImage?: string;
  referralCode?: string;
}

export interface WorkerMessage {
  type: "analyze";
  payload: {
    candles: Record<Timeframe, Candle[]>;
    fundamentalData: FundamentalData;
    assetConfig: AssetConfig;
  };
}

export interface WorkerResponse {
  type: "result" | "error";
  payload?: TradeIdea;
  error?: string;
}