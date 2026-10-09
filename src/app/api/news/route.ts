// API route for fetching news data (proxy to Finnhub / NewsAPI)

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// In-memory cache for news data
const newsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface NewsData {
  symbol: string;
  headlines: {
    headline: string;
    source: string;
    time: number;
    url?: string;
  }[];
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "XAU:USD";
    const category = searchParams.get("category") || "general";
    
    const cacheKey = `${symbol}-${category}`;
    const cached = newsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cached.data);
    }

    // Try Finnhub first
    const finnhubKey = process.env.FINNHUB_API_KEY;
    let data: NewsData | null = null;

    if (finnhubKey) {
      data = await fetchFinnhubNews(symbol, finnhubKey);
    }

    // Fallback to NewsAPI
    if (!data) {
      const newsApiKey = process.env.NEWS_API_KEY;
      if (newsApiKey) {
        data = await fetchNewsApi(symbol, category, newsApiKey);
      }
    }

    // If both fail, return mock data for development
    if (!data) {
      data = generateMockNews(symbol);
    }

    // Cache the result
    newsCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news data" },
      { status: 500 }
    );
  }
}

async function fetchFinnhubNews(
  symbol: string, 
  apiKey: string
): Promise<NewsData | null> {
  try {
    // Finnhub uses different symbol format (e.g., "OANDA:XAU_USD")
    // For simplicity, we'll use a generic approach
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`,
      { next: { revalidate: 900 } } // Cache for 15 minutes
    );

    if (!response.ok) {
      console.warn("Finnhub API error:", response.status);
      return null;
    }

    const result = await response.json();
    
    if (!Array.isArray(result)) {
      console.warn("Finnhub returned unexpected data format");
      return null;
    }

    // Convert Finnhub format to our format
    const headlines = result.slice(0, 20).map((item: any) => ({
      headline: item.headline,
      source: item.source,
      time: Math.floor(item.datetime),
      url: item.url,
    }));

    return {
      symbol,
      headlines,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Finnhub fetch error:", error);
    return null;
  }
}

async function fetchNewsApi(
  symbol: string, 
  category: string, 
  apiKey: string
): Promise<NewsData | null> {
  try {
    // NewsAPI requires a query - we'll use "gold" or the symbol
    const query = symbol.includes("XAU") ? "gold" : symbol;
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&apiKey=${apiKey}`,
      { next: { revalidate: 900 } }
    );

    if (!response.ok) {
      console.warn("NewsAPI error:", response.status);
      return null;
    }

    const result = await response.json();
    
    if (result.status !== "ok" || !result.articles) {
      console.warn("NewsAPI returned error:", result.message);
      return null;
    }

    // Convert NewsAPI format to our format
    const headlines = result.articles.slice(0, 20).map((article: any) => ({
      headline: article.title,
      source: article.source.name || "Unknown",
      time: Math.floor(new Date(article.publishedAt).getTime() / 1000),
      url: article.url,
    }));

    return {
      symbol,
      headlines,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("NewsAPI fetch error:", error);
    return null;
  }
}

// Generate mock news for development
function generateMockNews(symbol: string): NewsData {
  const now = Math.floor(Date.now() / 1000);
  const mockHeadlines = [
    {
      headline: "Fed signals possible rate cut amid cooling inflation",
      source: "Reuters",
      time: now - 1800, // 30 minutes ago
    },
    {
      headline: "Strong jobs data supports dollar strength",
      source: "Bloomberg",
      time: now - 3600, // 1 hour ago
    },
    {
      headline: "Geopolitical tensions boost safe-haven demand for gold",
      source: "CNN",
      time: now - 7200, // 2 hours ago
    },
    {
      headline: "Dollar index retreats as yields fall",
      source: "Financial Times",
      time: now - 10800, // 3 hours ago
    },
    {
      headline: "Retail sales miss expectations, hinting at consumer weakness",
      source: "Reuters",
      time: now - 14400, // 4 hours ago
    }
  ];

  return {
    symbol,
    headlines: mockHeadlines,
    timestamp: Date.now(),
  };
}