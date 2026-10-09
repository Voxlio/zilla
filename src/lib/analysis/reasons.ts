import { Candle, Reason, MarketStructure, FVG, LiquidityLevel, SessionRange, PremiumDiscountZones, FundamentalData } from "./types";

/**
 * Generate structured reasons from analysis data
 * @param params Analysis parameters
 * @returns Array of Reason objects
 */
export function generateReasons(params: {
  structure: MarketStructure;
  fvgs: FVG[];
  liquidity: LiquidityLevel[];
  sessions: SessionRange[];
  zones: PremiumDiscountZones;
  fundamentalData: FundamentalData;
  currentPrice: number;
}): Reason[] {
  const { structure, fvgs, liquidity, sessions, zones, fundamentalData, currentPrice } = params;
  const reasons: Reason[] = [];

  // 1. Market Structure reasons
  reasons.push(...generateStructureReasons(structure, currentPrice));

  // 2. FVG reasons
  reasons.push(...generateFVGReasons(fvgs, currentPrice));

  // 3. Liquidity reasons
  reasons.push(...generateLiquidityReasons(liquidity, currentPrice));

  // 4. Session reasons
  reasons.push(...generateSessionReasons(sessions, currentPrice));

  // 5. Premium/Discount reasons
  reasons.push(...generateZoneReasons(zones, currentPrice));

  // 6. Fundamental reasons
  reasons.push(...generateFundamentalReasons(fundamentalData));

  return reasons;
}

/**
 * Generate reasons from market structure
 */
function generateStructureReasons(structure: MarketStructure, currentPrice: number): Reason[] {
  const reasons: Reason[] = [];

  // Trend direction
  if (structure.trend === "bullish") {
    reasons.push({
      category: "structure",
      label: "Market Structure Trend",
      value: "Bullish (HH/HL)",
      direction: "bullish",
      weight: 85,
    });
  } else if (structure.trend === "bearish") {
    reasons.push({
      category: "structure",
      label: "Market Structure Trend",
      value: "Bearish (LH/LL)",
      direction: "bearish",
      weight: 85,
    });
  } else {
    reasons.push({
      category: "structure",
      label: "Market Structure Trend",
      value: "Ranging/Unclear",
      direction: "neutral",
      weight: 40,
    });
  }

  // Most recent BOS
  if (structure.bos.length > 0) {
    const lastBOS = structure.bos[structure.bos.length - 1];
    reasons.push({
      category: "structure",
      label: "Break of Structure",
      value: `${lastBOS.direction === "bullish" ? "Bullish" : "Bearish"} BOS at ${lastBOS.price.toFixed(2)}`,
      direction: lastBOS.direction,
      weight: 90,
    });
  }

  // Most recent CHoCH
  if (structure.choch.length > 0) {
    const lastCHoCH = structure.choch[structure.choch.length - 1];
    reasons.push({
      category: "structure",
      label: "Change of Character",
      value: `${lastCHoCH.direction === "bullish" ? "Bullish" : "Bearish"} CHoCH at ${lastCHoCH.price.toFixed(2)}`,
      direction: lastCHoCH.direction,
      weight: 95, // CHoCH is stronger than BOS
    });
  }

  return reasons;
}

/**
 * Generate reasons from FVGs
 */
function generateFVGReasons(fvgs: FVG[], currentPrice: number): Reason[] {
  const reasons: Reason[] = [];
  const unmitigated = fvgs.filter(fvg => !fvg.mitigated);

  // Count unmitigated FVGs by type
  const bullishFVGs = unmitigated.filter(fvg => fvg.type === "bullish");
  const bearishFVGs = unmitigated.filter(fvg => fvg.type === "bearish");

  // A bullish FVG is unfilled support, so the ones that matter sit BELOW price -
  // they are where a pullback can be bought. A bearish FVG is unfilled
  // resistance, so the ones that matter sit ABOVE price.
  const supportBelow = bullishFVGs.filter(fvg => fvg.top < currentPrice);
  const resistanceAbove = bearishFVGs.filter(fvg => fvg.bottom > currentPrice);

  if (supportBelow.length > 0) {
    // Nearest support below = the one with the highest top
    const nearest = supportBelow.reduce((closest, current) =>
      current.top > closest.top ? current : closest
    );
    reasons.push({
      category: "fvg",
      label: "Unmitigated Bullish FVG",
      value: `Below at ${nearest.bottom.toFixed(2)} - ${nearest.top.toFixed(2)}`,
      direction: "bullish",
      weight: 75,
    });
  }

  if (resistanceAbove.length > 0) {
    // Nearest resistance above = the one with the lowest bottom
    const nearest = resistanceAbove.reduce((closest, current) =>
      current.bottom < closest.bottom ? current : closest
    );
    reasons.push({
      category: "fvg",
      label: "Unmitigated Bearish FVG",
      value: `Above at ${nearest.bottom.toFixed(2)} - ${nearest.top.toFixed(2)}`,
      direction: "bearish",
      weight: 75,
    });
  }

  // Total count of unmitigated FVGs
  if (bullishFVGs.length > 0 || bearishFVGs.length > 0) {
    reasons.push({
      category: "fvg",
      label: "FVG Count",
      value: `${bullishFVGs.length} bullish, ${bearishFVGs.length} bearish unmitigated`,
      direction: bullishFVGs.length > bearishFVGs.length ? "bullish" : 
               bearishFVGs.length > bullishFVGs.length ? "bearish" : "neutral",
      weight: 60,
    });
  }

  return reasons;
}

/**
 * Generate reasons from liquidity levels
 */
function generateLiquidityReasons(liquidity: LiquidityLevel[], currentPrice: number): Reason[] {
  const reasons: Reason[] = [];

  // Get nearest buy-side and sell-side liquidity
  const buySide = liquidity.filter(l => l.type === "buy-side" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  const sellSide = liquidity.filter(l => l.type === "sell-side" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  if (buySide.length > 0) {
    const nearest = buySide[0];
    reasons.push({
      category: "liquidity",
      label: "Buy-Side Liquidity",
      value: `Nearest at ${nearest.price.toFixed(2)} (${nearest.source})`,
      direction: "bullish",
      weight: 80,
    });
  }

  if (sellSide.length > 0) {
    const nearest = sellSide[0];
    reasons.push({
      category: "liquidity",
      label: "Sell-Side Liquidity",
      value: `Nearest at ${nearest.price.toFixed(2)} (${nearest.source})`,
      direction: "bearish",
      weight: 80,
    });
  }

  // Count untested liquidity
  const untestedBuy = liquidity.filter(l => l.type === "buy-side" && !l.tested).length;
  const untestedSell = liquidity.filter(l => l.type === "sell-side" && !l.tested).length;

  if (untestedBuy > 0 || untestedSell > 0) {
    reasons.push({
      category: "liquidity",
      label: "Untested Liquidity Pools",
      value: `${untestedBuy} buy-side, ${untestedSell} sell-side`,
      direction: untestedBuy > untestedSell ? "bullish" : 
               untestedSell > untestedBuy ? "bearish" : "neutral",
      weight: 65,
    });
  }

  return reasons;
}

/**
 * Generate reasons from session data
 */
function generateSessionReasons(sessions: SessionRange[], currentPrice: number): Reason[] {
  const reasons: Reason[] = [];

  if (sessions.length === 0) return reasons;

  // Get the most recent session for each type
  const latestSessions: Record<string, SessionRange> = {};
  for (const session of sessions) {
    if (!latestSessions[session.session] || session.highTime > latestSessions[session.session].highTime) {
      latestSessions[session.session] = session;
    }
  }

  // Current session awareness (approximate based on current time)
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  let currentSession: "asia" | "london" | "ny" = "asia";
  if (currentHour >= 7 && currentHour < 16) currentSession = "london";
  else if (currentHour >= 12 && currentHour < 20) currentSession = "ny";

  const currentSessionData = latestSessions[currentSession];
  if (currentSessionData) {
    const positionInRange = (currentPrice - currentSessionData.low) / (currentSessionData.high - currentSessionData.low);
    
    if (positionInRange > 0.8) {
      reasons.push({
        category: "session",
        label: `${currentSession.toUpperCase()} Session Position`,
        value: `Near session high (${positionInRange.toFixed(0)}%)`,
        direction: "bearish",
        weight: 70,
      });
    } else if (positionInRange < 0.2) {
      reasons.push({
        category: "session",
        label: `${currentSession.toUpperCase()} Session Position`,
        value: `Near session low (${positionInRange.toFixed(0)}%)`,
        direction: "bullish",
        weight: 70,
      });
    } else {
      reasons.push({
        category: "session",
        label: `${currentSession.toUpperCase()} Session Position`,
        value: `Mid-range (${(positionInRange * 100).toFixed(0)}%)`,
        direction: "neutral",
        weight: 40,
      });
    }
  }

  // London/NY overlap liquidity
  const london = latestSessions.london;
  const ny = latestSessions.ny;
  
  if (london && ny) {
    const overlapHigh = Math.max(london.high, ny.high);
    const overlapLow = Math.min(london.low, ny.low);
    
    if (currentPrice > overlapHigh) {
      reasons.push({
        category: "session",
        label: "London/NY Overlap",
        value: `Above overlap high (${overlapHigh.toFixed(2)})`,
        direction: "bearish",
        weight: 65,
      });
    } else if (currentPrice < overlapLow) {
      reasons.push({
        category: "session",
        label: "London/NY Overlap",
        value: `Below overlap low (${overlapLow.toFixed(2)})`,
        direction: "bullish",
        weight: 65,
      });
    }
  }

  return reasons;
}

/**
 * Generate reasons from premium/discount zones
 */
function generateZoneReasons(zones: PremiumDiscountZones, currentPrice: number): Reason[] {
  const reasons: Reason[] = [];

  if (currentPrice >= zones.premium.bottom) {
    reasons.push({
      category: "premium-discount",
      label: "Price Location",
      value: "Premium zone (above equilibrium)",
      direction: "bearish", // In premium, bias is to sell
      weight: 80,
    });
  } else if (currentPrice <= zones.discount.top) {
    reasons.push({
      category: "premium-discount",
      label: "Price Location",
      value: "Discount zone (below equilibrium)",
      direction: "bullish", // In discount, bias is to buy
      weight: 80,
    });
  } else {
    reasons.push({
      category: "premium-discount",
      label: "Price Location",
      value: "Equilibrium zone",
      direction: "neutral",
      weight: 50,
    });
  }

  // Distance from equilibrium
  const distanceFromEq = ((currentPrice - zones.equilibrium) / (zones.rangeHigh - zones.rangeLow)) * 100;
  reasons.push({
    category: "premium-discount",
    label: "Distance from Equilibrium",
    value: `${distanceFromEq > 0 ? "+" : ""}${distanceFromEq.toFixed(1)}%`,
    direction: distanceFromEq > 0 ? "bearish" : "bullish",
    weight: 60,
  });

  return reasons;
}

/**
 * Generate reasons from fundamental data
 */
function generateFundamentalReasons(fundamentalData: FundamentalData): Reason[] {
  const reasons: Reason[] = [];

  // Calendar events
  for (const event of fundamentalData.calendar) {
    if (event.actual && event.forecast) {
      const actual = parseFloat(event.actual);
      const forecast = parseFloat(event.forecast);
      
      if (!isNaN(actual) && !isNaN(forecast)) {
        const diff = actual - forecast;
        let direction: "bullish" | "bearish" | "neutral" = "neutral";
        let label = event.event;
        let weight = event.impact === "high" ? 90 : event.impact === "medium" ? 70 : 50;
        
        // USD positive events: higher = USD up = Gold down (bearish)
        const usdPositiveEvents = ["CPI", "NFP", "Retail Sales", "Core CPI", "PPI", "ISM", "GDP", "Yields"];
        const usdNegativeEvents = ["Jobless Claims", "Unemployment Rate"];
        
        const isUsdPositive = usdPositiveEvents.some(e => event.event.includes(e));
        const isUsdNegative = usdNegativeEvents.some(e => event.event.includes(e));
        
        if (isUsdPositive) {
          direction = diff > 0 ? "bearish" : diff < 0 ? "bullish" : "neutral";
        } else if (isUsdNegative) {
          direction = diff > 0 ? "bullish" : diff < 0 ? "bearish" : "neutral";
        }
        
        if (direction !== "neutral") {
          reasons.push({
            category: "fundamental",
            label: `Calendar: ${event.event}`,
            value: `Actual: ${event.actual}, Forecast: ${event.forecast} (${diff > 0 ? "+" : ""}${diff.toFixed(1)})`,
            direction,
            weight,
          });
        }
      }
    }
  }

  // Headline sentiment
  if (fundamentalData.headlines.length > 0) {
    const bullishKeywords = ["rate cut", "dovish", "safe haven", "recession", "crisis", "war", "geopolitical", "inflation cooling", "fed pivot"];
    const bearishKeywords = ["hawkish", "strong dollar", "yields rise", "rate hike", "tightening", "strong economy", "soft landing"];
    
    let bullishScore = 0;
    let bearishScore = 0;
    
    for (const headline of fundamentalData.headlines) {
      const text = headline.headline.toLowerCase();
      const hoursAgo = (Date.now() / 1000 - headline.time) / 3600;
      const recencyWeight = Math.max(0.2, 1 - hoursAgo / 48); // Decay over 48 hours
      
      for (const kw of bullishKeywords) {
        if (text.includes(kw.toLowerCase())) {
          bullishScore += recencyWeight;
        }
      }
      for (const kw of bearishKeywords) {
        if (text.includes(kw.toLowerCase())) {
          bearishScore += recencyWeight;
        }
      }
    }
    
    if (bullishScore > bearishScore) {
      reasons.push({
        category: "fundamental",
        label: "News Sentiment",
        value: `Bullish keywords dominate (${bullishScore.toFixed(1)} vs ${bearishScore.toFixed(1)})`,
        direction: "bullish",
        weight: Math.min(85, 40 + bullishScore * 5),
      });
    } else if (bearishScore > bullishScore) {
      reasons.push({
        category: "fundamental",
        label: "News Sentiment",
        value: `Bearish keywords dominate (${bearishScore.toFixed(1)} vs ${bullishScore.toFixed(1)})`,
        direction: "bearish",
        weight: Math.min(85, 40 + bearishScore * 5),
      });
    }
  }

  // High-impact event warning
  const upcomingHighImpact = fundamentalData.calendar.filter(e => 
    e.impact === "high" && 
    e.time > Date.now() / 1000 && 
    e.time < Date.now() / 1000 + 4 * 3600
  );
  
  if (upcomingHighImpact.length > 0) {
    reasons.push({
      category: "fundamental",
      label: "Volatility Warning",
      value: `${upcomingHighImpact.length} high-impact USD event(s) within 4 hours`,
      direction: "neutral",
      weight: 70,
    });
  }

  return reasons;
}

/**
 * Sort reasons by weight (descending)
 */
export function sortReasonsByWeight(reasons: Reason[]): Reason[] {
  return [...reasons].sort((a, b) => b.weight - a.weight);
}

/**
 * Get top N reasons
 */
export function getTopReasons(reasons: Reason[], n: number = 5): Reason[] {
  return sortReasonsByWeight(reasons).slice(0, n);
}