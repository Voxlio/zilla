// API route for fetching economic calendar data (proxy to faireconomy.media / Finnhub)

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// In-memory cache for calendar data
const calendarCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CalendarData {
  symbol: string;
  events: {
    time: number;
    currency: string;
    impact: "high" | "medium" | "low";
    event: string;
    actual?: string;
    forecast?: string;
    previous?: string;
  }[];
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "XAU:USD";
    
    const cacheKey = `calendar-${symbol}`;
    const cached = calendarCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      return NextResponse.json(cached.data);
    }

    // Try faireconomy.media first (free)
    let data: CalendarData | null = null;

    data = await fetchFaireconomyMediaCalendar(symbol);

    // Fallback to Finnhub if needed
    if (!data) {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      if (finnhubKey) {
        data = await fetchFinnhubCalendar(symbol, finnhubKey);
      }
    }

    // If both fail, return mock data for development
    if (!data) {
      data = generateMockCalendar(symbol);
    }

    // Cache the result
    calendarCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching calendar:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar data" },
      { status: 500 }
    );
  }
}

async function fetchFaireconomyMediaCalendar(
  symbol: string
): Promise<CalendarData | null> {
  try {
    // Faireconomy.media provides a free JSON mirror
    const response = await fetch(
      "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
      { next: { revalidate: 1800 } } // Cache for 30 minutes
    );

    if (!response.ok) {
      console.warn("Faireconomy.media API error:", response.status);
      return null;
    }

    const result = await response.json();
    
    // Filter for USD events only (as per requirements)
    const usdEvents = result
      .filter((item: any) => item.currency === "USD")
      .map((item: any) => ({
        time: Math.floor(new Date(item.date).getTime() / 1000),
        currency: item.currency,
        impact: item.impact as "high" | "medium" | "low",
        event: item.event,
        actual: item.actual || "",
        forecast: item.forecast || "",
        previous: item.previous || "",
      }));

    return {
      symbol,
      events: usdEvents,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Faireconomy.media fetch error:", error);
    return null;
  }
}

async function fetchFinnhubCalendar(
  symbol: string, 
  apiKey: string
): Promise<CalendarData | null> {
  try {
    // Finnhub economic calendar endpoint
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?token=${apiKey}`,
      { next: { revalidate: 1800 } }
    );

    if (!response.ok) {
      console.warn("Finnhub calendar API error:", response.status);
      return null;
    }

    const result = await response.json();
    
    if (!result.economicCalendar) {
      console.warn("Finnhub returned unexpected data format");
      return null;
    }

    // Filter for USD events and convert format
    const usdEvents = result.economicCalendar
      .filter((item: any) => item.currency === "USD")
      .map((item: any) => ({
        time: Math.floor(new Date(item.date).getTime() / 1000),
        currency: item.currency,
        impact: item.impact as "high" | "medium" | "low",
        event: item.event,
        actual: item.actual || "",
        forecast: item.forecast || "",
        previous: item.previous || "",
      }));

    return {
      symbol,
      events: usdEvents,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Finnhub calendar fetch error:", error);
    return null;
  }
}

// Generate mock calendar for development
function generateMockCalendar(symbol: string): CalendarData {
  const now = Math.floor(Date.now() / 1000);
  const mockEvents = [
    {
      time: now - 7200, // 2 hours ago
      currency: "USD",
      impact: "high" as const,
      event: "CPI",
      actual: "3.2%",
      forecast: "3.0%",
      previous: "2.9%",
    },
    {
      time: now + 3600, // 1 hour from now
      currency: "USD",
      impact: "high" as const,
      event: "NFP",
      actual: "150K",
      forecast: "180K",
      previous: "175K",
    },
    {
      time: now + 10800, // 3 hours from now
      currency: "USD",
      impact: "medium" as const,
      event: "Retail Sales",
      actual: "0.5%",
      forecast: "0.6%",
      previous: "0.4%",
    },
    {
      time: now + 18000, // 5 hours from now
      currency: "USD",
      impact: "low" as const,
      event: "Jobless Claims",
      actual: "220K",
      forecast: "225K",
      previous: "223K",
    }
  ];

  return {
    symbol,
    events: mockEvents,
    timestamp: Date.now(),
  };
}