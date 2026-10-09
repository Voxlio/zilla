// History module utilities for Dexie IndexedDB

import Dexie from "dexie";
import { HistoryEntry, HistoryFilters, HistoryStats } from "./types";

// Define the database schema
class ZillaHistoryDB extends Dexie {
  trades!: Dexie.Table<HistoryEntry, string>; // id is the primary key

  constructor() {
    super("zillaHistoryDB");
    this.version(1).stores({
      trades: "id, timestamp, date, symbol, direction, outcome, confidence",
    });
  }
}

// Create a singleton instance
export const db = new ZillaHistoryDB();

/**
 * Save a trade idea to history
 * @param trade Trade idea to save
 */
export async function saveTradeToHistory(trade: import("@/lib/analysis/types").TradeIdea): Promise<void> {
  const historyEntry: HistoryEntry = {
    id: trade.id,
    date: new Date(trade.timestamp).toISOString().split("T")[0],
    timestamp: trade.timestamp,
    symbol: trade.symbol,
    direction: trade.direction,
    entry: trade.entry,
    stopLoss: trade.stopLoss,
    takeProfit1: trade.takeProfit1,
    takeProfit2: trade.takeProfit2,
    riskReward: trade.riskReward,
    confidence: trade.confidence,
    thesis: generateThesisSummary(trade),
    outcome: "pending", // Initially pending
  };

  try {
    await db.trades.put(historyEntry);
  } catch (error) {
    console.error("Error saving trade to history:", error);
  }
}

/**
 * Generate a thesis summary from trade idea for history storage
 */
function generateThesisSummary(trade: import("@/lib/analysis/types").TradeIdea): string {
  const { direction, entry, stopLoss, takeProfit1, takeProfit2, currentPrice } = trade;
  
  return `${direction.toUpperCase()} XAUUSD at ${entry.toFixed(2)} ` +
    `SL ${stopLoss.toFixed(2)} TP1 ${takeProfit1.toFixed(2)} TP2 ${takeProfit2.toFixed(2)} ` +
    `(RR: ${trade.riskReward.toFixed(2)}, Conf: ${trade.confidence}%)`;
}

/**
 * Get all trades from history
 * @returns Array of history entries
 */
export async function getAllHistory(): Promise<HistoryEntry[]> {
  try {
    return await db.trades.reverse().toArray(); // Most recent first
  } catch (error) {
    console.error("Error getting history:", error);
    return [];
  }
}

/**
 * Get trades with filters
 * @param filters Filter criteria
 * @returns Filtered history entries
 */
export async function getFilteredHistory(filters: HistoryFilters = {}): Promise<HistoryEntry[]> {
  try {
    let trades = await db.trades.reverse().toArray();
    
    // Apply filters
    if (filters.symbol) {
      trades = trades.filter(t => t.symbol === filters.symbol);
    }
    if (filters.direction) {
      trades = trades.filter(t => t.direction === filters.direction);
    }
    if (filters.outcome) {
      trades = trades.filter(t => t.outcome === filters.outcome);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      trades = trades.filter(t => t.timestamp >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime() + 86400000; // End of day
      trades = trades.filter(t => t.timestamp <= end);
    }
    if (filters.minConfidence !== undefined) {
      const minConf = filters.minConfidence;
      trades = trades.filter(t => t.confidence >= minConf);
    }
    
    return trades;
  } catch (error) {
    console.error("Error getting filtered history:", error);
    return [];
  }
}

/**
 * Update the outcome of a trade based on price action
 * @param tradeId ID of the trade to update
 * @param candles Candles to check for outcome
 */
export async function updateTradeOutcome(
  tradeId: string, 
  candles: import("@/lib/analysis/types").Candle[]
): Promise<void> {
  try {
    const trade = await db.trades.get(tradeId);
    if (!trade) {
      console.warn(`Trade ${tradeId} not found in history`);
      return;
    }
    
    // Skip if already has a final outcome
    if (trade.outcome === "tp1" || trade.outcome === "tp2" || trade.outcome === "sl") {
      return;
    }
    
    const { entry, stopLoss, takeProfit1, takeProfit2 } = trade;
    const risk = Math.abs(entry - stopLoss);
    
    // Check each candle in chronological order
    for (const candle of candles) {
      // Check for TP1 or TP2 hit (both directions)
      const tp1Hit = 
        (trade.direction === "buy" && candle.high >= takeProfit1) ||
        (trade.direction === "sell" && candle.low <= takeProfit1);
      
      const tp2Hit = 
        (trade.direction === "buy" && candle.high >= takeProfit2) ||
        (trade.direction === "sell" && candle.low <= takeProfit2);
      
      // Check for SL hit
      const slHit = 
        (trade.direction === "buy" && candle.low <= stopLoss) ||
        (trade.direction === "sell" && candle.high >= stopLoss);
      
      // Determine outcome (prioritize SL over TP if both happen in same candle)
      if (slHit) {
        const outcomeR = -1; // SL is always -1R
        await db.trades.update(tradeId, {
          outcome: "sl",
          outcomeR,
          candlesChecked: [...(trade.candlesChecked || []), candle]
        });
        return;
      }
      
      if (tp2Hit) {
        const outcomeR = (takeProfit2 - entry) / risk * (trade.direction === "buy" ? 1 : -1);
        await db.trades.update(tradeId, {
          outcome: "tp2",
          outcomeR,
          candlesChecked: [...(trade.candlesChecked || []), candle]
        });
        return;
      }
      
      if (tp1Hit) {
        const outcomeR = (takeProfit1 - entry) / risk * (trade.direction === "buy" ? 1 : -1);
        await db.trades.update(tradeId, {
          outcome: "tp1",
          outcomeR,
          candlesChecked: [...(trade.candlesChecked || []), candle]
        });
        return;
      }
    }
    
    // If we get here, no outcome was hit - mark as expired if candle is old enough
    const lastCandle = candles[candles.length - 1];
    const tradeTime = new Date(trade.timestamp);
    const candleTime = new Date(lastCandle.time * 1000);
    const hoursDiff = (candleTime.getTime() - tradeTime.getTime()) / (1000 * 3600);
    
    // Expire after 48 hours if no outcome
    if (hoursDiff > 48) {
      await db.trades.update(tradeId, {
        outcome: "expired",
        outcomeR: 0, // No profit/loss if expired
        candlesChecked: [...(trade.candlesChecked || []), lastCandle]
      });
    }
  } catch (error) {
    console.error("Error updating trade outcome:", error);
  }
}

/**
 * Calculate statistics from history
 * @returns History statistics
 */
export async function getHistoryStats(): Promise<HistoryStats> {
  try {
    const trades = await db.trades.toArray();
    const closedTrades = trades.filter(t => 
      t.outcome === "tp1" || t.outcome === "tp2" || t.outcome === "sl"
    );
    
    const totalR = closedTrades.reduce((sum, t) => sum + (t.outcomeR || 0), 0);
    const winRate = closedTrades.length > 0 ? 
      (closedTrades.filter(t => t.outcomeR && t.outcomeR > 0).length / closedTrades.length) * 100 : 0;
    const avgR = closedTrades.length > 0 ? totalR / closedTrades.length : 0;
    const bestR = closedTrades.reduce((max, t) => Math.max(max, t.outcomeR || 0), 0);
    
    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      totalR: parseFloat(totalR.toFixed(2)),
      avgR: parseFloat(avgR.toFixed(2)),
      bestR: parseFloat(bestR.toFixed(2)),
    };
  } catch (error) {
    console.error("Error calculating history stats:", error);
    return {
      totalTrades: 0,
      closedTrades: 0,
      winRate: 0,
      totalR: 0,
      avgR: 0,
      bestR: 0,
    };
  }
}

/**
 * Clear all history (for development/testing)
 */
export async function clearHistory(): Promise<void> {
  try {
    await db.trades.clear();
  } catch (error) {
    console.error("Error clearing history:", error);
  }
}