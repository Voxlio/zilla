// History module types

export interface HistoryEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: number; // Unix timestamp in milliseconds
  symbol: string;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number;
  thesis: string;
  outcome?: "tp1" | "tp2" | "sl" | "pending" | "expired";
  outcomeR?: number;
  candlesChecked?: import("@/lib/analysis/types").Candle[];
}

export interface HistoryFilters {
  symbol?: string;
  direction?: "buy" | "sell";
  outcome?: "tp1" | "tp2" | "sl" | "pending" | "expired";
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  minConfidence?: number;
}

export interface HistoryStats {
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  totalR: number;
  avgR: number;
  bestR: number;
}