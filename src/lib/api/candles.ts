// API utilities for fetching candle data

import type { Candle } from "@/lib/analysis/types";

export interface CandleData {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  timestamp: number;
}

/**
 * Fetch candle data for a given symbol and timeframe
 * @param symbol The trading symbol (e.g., "XAU/USD")
 * @param timeframe The timeframe (e.g., "15min", "1h", "4h", "daily")
 * @returns Promise with candle data
 */
export async function getCandles(
  symbol: string,
  timeframe: string
): Promise<CandleData> {
  try {
    const response = await fetch(
      `/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
      {
        // Cache for 5 minutes
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching candles:", error);
    // Return empty data as fallback
    return {
      symbol,
      timeframe,
      candles: [],
      timestamp: Date.now(),
    };
  }
}

// Export for use in components
export const candleApi = {
  getCandles,
};