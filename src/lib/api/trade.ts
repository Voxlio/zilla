// API utilities for trade generation

import type { WorkerMessage, WorkerResponse } from "@/lib/analysis/types";
import type { FundamentalData } from "@/lib/fundamentals/types";
import type { AssetConfig } from "@/lib/analysis/types";
import { runAnalysisInWorker } from "@/lib/analysis/worker";
import { FaireconomyMediaCalendarAdapter } from "@/lib/fundamentals/scorer";
import { FinnhubNewsAdapter } from "@/lib/fundamentals/scorer";
import { NewsApiAdapter } from "@/lib/fundamentals/scorer";

// Asset configuration
export const ASSET_CONFIGS: Record<string, AssetConfig> = {
  XAUUSD: {
    symbol: "XAUUSD",
    name: "XAU/USD",
    displayName: "Gold",
    pipSize: 0.01,
    contractSize: 100,
    marginCurrency: "USD",
  },
  // More assets can be added here
};

// Mock data adapters for development
const mockCalendarAdapter = {
  fetchThisWeek: async () => {
    return [
      {
        time: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        currency: "USD",
        impact: "high" as const,
        event: "CPI",
        actual: "3.2%",
        forecast: "3.0%",
        previous: "2.9%",
      },
      {
        time: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        currency: "USD",
        impact: "high" as const,
        event: "NFP",
        actual: "150K",
        forecast: "180K",
        previous: "175K",
      }
    ];
  }
};

const mockNewsAdapter = {
  fetchNews: async () => {
    return [
      {
        headline: "Fed signals possible rate cut amid cooling inflation",
        source: "Reuters",
        time: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
      },
      {
        headline: "Strong jobs data supports dollar strength",
        source: "Bloomberg",
        time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      }
    ];
  }
};

// Initialize adapters
const calendarAdapter = process.env.NODE_ENV === "development" 
  ? mockCalendarAdapter 
  : new FaireconomyMediaCalendarAdapter();

const newsAdapter = process.env.NODE_ENV === "development"
  ? mockNewsAdapter
  : new FinnhubNewsAdapter(process.env.FINNHUB_API_KEY || "");

// Fallback to NewsAPI if Finnhub not available
const newsApiAdapter = process.env.NODE_ENV === "development"
  ? mockNewsAdapter
  : new NewsApiAdapter(process.env.NEWS_API_KEY || "");

// Trade response type
export interface TradeResponse {
  trade?: import("@/lib/analysis/types").TradeIdea;
  error?: string;
}

/**
 * Generate a trade idea for a given symbol
 * @param symbol The trading symbol (e.g., "XAUUSD")
 * @param forceRefresh Whether to bypass daily cache
 * @returns Promise with trade idea or error
 */
export async function generateTrade(
  symbol: string,
  forceRefresh = false
): Promise<TradeResponse> {
  try {
    // Validate symbol
    const assetConfig = ASSET_CONFIGS[symbol.toUpperCase()];
    if (!assetConfig) {
      return { 
        error: `Unsupported symbol: ${symbol}. Currently only XAUUSD is supported.` 
      };
    }

    // Check if we should use cached result (one idea per day)
    // In a real app, this would check localStorage or IndexedDB
    // For now, we'll always generate fresh (can be enhanced later)
    
    // Fetch candle data for all timeframes
    const candleData = await fetchAllCandles();
    
    // Fetch fundamental data
    const [calendarData, newsData] = await Promise.all([
      calendarAdapter.fetchThisWeek(),
      newsAdapter.fetchNews()
    ]);
    
    // Prepare fundamental data
    const fundamentalData: FundamentalData = {
      calendar: calendarData,
      headlines: newsData,
      score: 0, // Will be calculated by scorer
      warnings: []
    };

    // Prepare worker message
    const workerMessage: WorkerMessage = {
      type: "analyze",
      payload: {
        candles: candleData,
        fundamentalData,
        assetConfig
      }
    };

    // Run analysis in web worker
    const workerResponse = await runAnalysisInWorker(workerMessage);
    
    if (workerResponse.type === "result" && workerResponse.payload) {
      return { trade: workerResponse.payload };
    } else {
      return { 
        error: workerResponse.error || "Failed to generate trade idea" 
      };
    }
  } catch (error) {
    console.error("Error generating trade:", error);
    return { 
      error: "An unexpected error occurred while generating the trade idea" 
    };
  }
}

/**
 * Fetch candle data for all timeframes
 * @returns Promise with candle data for M15, H1, H4, D1
 */
async function fetchAllCandles(): Promise<
  Record<"M15" | "H1" | "H4" | "D1", import("@/lib/analysis/types").Candle[]>
> {
  try {
    // In a real app, these would be actual API calls to our endpoints
    // For now, we'll use mock data or call our own API routes
    
    const timeframes: Record<string, string> = {
      M15: "15min",
      H1: "1h",
      H4: "4h",
      D1: "daily"
    };
    
    const results: Record<string, any> = {};
    
    // Try to fetch from our own API first
    for (const [tf, interval] of Object.entries(timeframes)) {
      try {
        const response = await fetch(`/api/candles?symbol=XAU/USD&timeframe=${interval}`);
        if (response.ok) {
          const data = await response.json();
          results[tf as keyof typeof results] = data.candles || [];
        } else {
          // Fallback to mock data
          results[tf as keyof typeof results] = generateMockCandles(tf);
        }
      } catch (err) {
        console.warn(`Failed to fetch ${tf} candles, using mock data:`, err);
        results[tf as keyof typeof results] = generateMockCandles(tf);
      }
    }
    
    return results as Record<"M15" | "H1" | "H4" | "D1", import("@/lib/analysis/types").Candle[]>;
  } catch (error) {
    console.error("Error fetching candle data:", error);
    // Return all mock data as fallback
    return {
      M15: generateMockCandles("M15"),
      H1: generateMockCandles("H1"),
      H4: generateMockCandles("H4"),
      D1: generateMockCandles("D1")
    };
  }
}

/**
 * Generate mock candle data for development
 * @param timeframe Timeframe identifier
 * @returns Array of mock candles
 */
function generateMockCandles(timeframe: string): import("@/lib/analysis/types").Candle[] {
  const now = Math.floor(Date.now() / 1000);
  const candles = [];
  let price = 2000 + Math.random() * 100; // Start around 2000-2100
  
  // Determine interval in seconds
  let intervalSeconds = 900; // 15 min default
  if (timeframe === "H1") intervalSeconds = 3600;
  else if (timeframe === "H4") intervalSeconds = 14400;
  else if (timeframe === "D1") intervalSeconds = 86400;

  // Generate 200 candles
  for (let i = 199; i >= 0; i--) {
    const time = now - (i * intervalSeconds);
    const volatility = price * 0.002; // 0.2% volatility
    const change = (Math.random() - 0.5) * volatility * 2;
    
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    candles.push({ 
      time, 
      open, 
      high, 
      low, 
      close, 
      volume: Math.floor(Math.random() * 10000) 
    });
    price = close;
  }

  return candles;
}

// Export for use in pages
export const tradeApi = {
  generateTrade
};