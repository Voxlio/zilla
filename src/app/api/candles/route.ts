// API route for fetching candle data (proxy to Twelve Data / Alpha Vantage)

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// In-memory cache for candle data
const candleCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CandleData {
  symbol: string;
  timeframe: string;
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }[];
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "XAU/USD";
    const timeframe = searchParams.get("timeframe") || "15min";
    const interval = searchParams.get("interval") || timeframe;
    
    const cacheKey = `${symbol}-${timeframe}`;
    const cached = candleCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cached.data);
    }

    // Try Twelve Data first
    const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
    let data: CandleData | null = null;

    if (twelveDataKey) {
      data = await fetchTwelveData(symbol, interval, twelveDataKey);
    }

    // Fallback to Alpha Vantage
    if (!data) {
      const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (alphaVantageKey) {
        data = await fetchAlphaVantage(symbol, interval, alphaVantageKey);
      }
    }

    // If both fail, return mock data for development
    if (!data) {
      data = generateMockCandles(symbol, timeframe);
    }

    // Cache the result
    candleCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching candles:", error);
    return NextResponse.json(
      { error: "Failed to fetch candle data" },
      { status: 500 }
    );
  }
}

async function fetchTwelveData(
  symbol: string, 
  interval: string, 
  apiKey: string
): Promise<CandleData | null> {
  try {
    // Twelve Data uses XAU/USD format (with slash)
    const tdSymbol = symbol;
    
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${tdSymbol}&interval=${interval}&outputsize=200&apikey=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      console.warn("Twelve Data API error:", response.status);
      return null;
    }

    const result = await response.json();
    
    if (result.status === "error" || !result.values) {
      console.warn("Twelve Data returned error:", result.message);
      return null;
    }

    // Convert Twelve Data format to our format
    // Twelve Data already gives price in correct format (dollars per ounce)
    const candles = result.values.map((item: any) => ({
      time: Math.floor(new Date(item.datetime).getTime() / 1000),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: item.volume ? parseInt(item.volume) : undefined,
    })).reverse(); // Twelve Data returns newest first, we want oldest first

    return {
      symbol,
      timeframe: interval,
      candles,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Twelve Data fetch error:", error);
    return null;
  }
}

async function fetchAlphaVantage(
  symbol: string, 
  interval: string, 
  apiKey: string
): Promise<CandleData | null> {
  try {
    // Alpha Vantage uses different symbol and interval formats
    const avSymbol = symbol.replace("/", "");
    let avInterval = "15min";
    
    if (interval.includes("60") || interval === "1h" || interval === "H1") {
      avInterval = "60min";
    } else if (interval.includes("240") || interval === "4h" || interval === "H4") {
      avInterval = "60min"; // AV doesn't have 4h directly, would need to aggregate
    } else if (interval.includes("daily") || interval === "D1") {
      avInterval = "daily";
    }

    const functionName = avInterval === "daily" ? "TIME_SERIES_DAILY" : "TIME_SERIES_INTRADAY";
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${avSymbol}&interval=${avInterval}&outputsize=compact&apikey=${apiKey}`;

    const response = await fetch(url, { next: { revalidate: 300 } });
    
    if (!response.ok) {
      console.warn("Alpha Vantage API error:", response.status);
      return null;
    }

    const result = await response.json();
    
    // Check for API errors
    if (result["Error Message"] || result["Note"]) {
      console.warn("Alpha Vantage returned error:", result["Error Message"] || result["Note"]);
      return null;
    }

    // Parse time series data
    const timeSeriesKey = Object.keys(result).find(k => k.includes("Time Series"));
    if (!timeSeriesKey || !result[timeSeriesKey]) {
      return null;
    }

    const timeSeries = result[timeSeriesKey];
    const candles = Object.entries(timeSeries)
      .map(([datetime, values]: [string, any]) => ({
        time: Math.floor(new Date(datetime).getTime() / 1000),
        open: parseFloat(values["1. open"]),
        high: parseFloat(values["2. high"]),
        low: parseFloat(values["3. low"]),
        close: parseFloat(values["4. close"]),
        volume: parseInt(values["5. volume"] || "0"),
      }))
      .reverse(); // Alpha Vantage returns newest first

    return {
      symbol,
      timeframe: interval,
      candles,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Alpha Vantage fetch error:", error);
    return null;
  }
}

// Generate mock candles for development
function generateMockCandles(symbol: string, timeframe: string): CandleData {
  const now = Math.floor(Date.now() / 1000);
  const candles = [];
  let price = 2000 + Math.random() * 100; // Start around 2000-2100
  
  // Determine interval in seconds
  let intervalSeconds = 900; // 15 min default
  if (timeframe.includes("60") || timeframe === "1h" || timeframe === "H1") intervalSeconds = 3600;
  else if (timeframe.includes("240") || timeframe === "4h" || timeframe === "H4") intervalSeconds = 14400;
  else if (timeframe.includes("daily") || timeframe === "D1") intervalSeconds = 86400;

  // Generate 200 candles
  for (let i = 199; i >= 0; i--) {
    const time = now - (i * intervalSeconds);
    const volatility = price * 0.002; // 0.2% volatility
    const change = (Math.random() - 0.5) * volatility * 2;
    
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    candles.push({ time, open, high, low, close, volume: Math.floor(Math.random() * 10000) });
    price = close;
  }

  return {
    symbol,
    timeframe,
    candles,
    timestamp: Date.now(),
  };
}