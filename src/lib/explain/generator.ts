import { 
  TradeIdea, 
  Reason 
} from "@/lib/analysis/types";
import { 
  AnalysisReport, 
  WhyThisTrade, 
  SimpleSummary, 
  FullReport,
  defaultPhrasingVariants,
  analogyTemplates 
} from "./types";

/**
 * Generate a full explanation report from a trade idea
 * @param trade Trade idea with all analysis data
 * @returns Full report with all sections
 */
export function generateFullReport(trade: TradeIdea): FullReport {
  const analysisReport = generateAnalysisReport(trade);
  const whyThisTrade = generateWhyThisTrade(trade);
  const simpleSummary = generateSimpleSummary(trade);
  
  return {
    analysisReport,
    whyThisTrade,
    simpleSummary,
    disclaimer: trade.disclaimer,
  };
}

/**
 * Generate the main analysis report sections
 */
function generateAnalysisReport(trade: TradeIdea): AnalysisReport {
  const { direction, entry, stopLoss, takeProfit1, takeProfit2, currentPrice, structure, fvgs, liquidity, zones, timestamp } = trade;
  
  // Daily Thesis
  const dailyThesis = generateDailyThesis(direction, structure, zones, currentPrice);
  
  // Current Price Action
  const currentPriceAction = generateCurrentPriceAction(direction, currentPrice, zones, structure);
  
  // M15 Breakdown
  const m15Breakdown = generateM15Breakdown(direction, structure, fvgs, liquidity, zones);
  
  // Liquidity Levels
  const liquidityLevels = generateLiquidityLevelsSection(liquidity, currentPrice);
  
  // What to Watch
  const whatToWatch = generateWhatToWatch(direction, entry, stopLoss, takeProfit1, takeProfit2, liquidity, zones);

  return {
    dailyThesis,
    currentPriceAction,
    m15Breakdown,
    liquidityLevels,
    whatToWatch,
    timestamp: formatTimestamp(timestamp),
    price: currentPrice,
  };
}

/**
 * Generate daily thesis with badge
 */
function generateDailyThesis(
  direction: "buy" | "sell",
  structure: TradeIdea["structure"],
  zones: TradeIdea["zones"],
  currentPrice: number
): AnalysisReport["dailyThesis"] {
  const badge = direction === "buy" ? "bullish" : "bearish";
  
  let title = "";
  let summary = "";
  
  if (direction === "buy") {
    title = "Bullish Bias - Buy the Dip";
    const trend = structure.trend === "bullish" ? "uptrend" : 
                  structure.trend === "bearish" ? "potential reversal" : "consolidation";
    const zone = getPriceZone(currentPrice, zones) === "discount" ? "discount zone" : "near equilibrium";
    
    summary = `Gold shows a ${trend} on the higher timeframes with price currently in the ${zone}. ` +
      `We're looking for a pullback to an unmitigated bullish FVG or discount zone for a long entry ` +
      `targeting the next buy-side liquidity pools above.`;
  } else {
    title = "Bearish Bias - Sell the Rally";
    const trend = structure.trend === "bearish" ? "downtrend" : 
                  structure.trend === "bullish" ? "potential reversal" : "consolidation";
    const zone = getPriceZone(currentPrice, zones) === "premium" ? "premium zone" : "near equilibrium";
    
    summary = `Gold shows a ${trend} on the higher timeframes with price currently in the ${zone}. ` +
      `We're looking for a rally to an unmitigated bearish FVG or premium zone for a short entry ` +
      `targeting the next sell-side liquidity pools below.`;
  }
  
  return { badge, title, summary };
}

/**
 * Get price zone string
 */
function getPriceZone(
  price: number, 
  zones: TradeIdea["zones"]
): "premium" | "discount" | "equilibrium" {
  if (price >= zones.premium.bottom) return "premium";
  if (price <= zones.discount.top) return "discount";
  return "equilibrium";
}

/**
 * Generate current price action section
 */
function generateCurrentPriceAction(
  direction: "buy" | "sell",
  currentPrice: number,
  zones: TradeIdea["zones"],
  structure: TradeIdea["structure"]
): AnalysisReport["currentPriceAction"] {
  const zone = getPriceZone(currentPrice, zones);
  const trend = structure.trend;
  
  let content = `Gold is trading at $${currentPrice.toFixed(2)}, `;
  
  if (zone === "discount") {
    content += `in the discount zone (below equilibrium at $${zones.equilibrium.toFixed(2)}). `;
  } else if (zone === "premium") {
    content += `in the premium zone (above equilibrium at $${zones.equilibrium.toFixed(2)}). `;
  } else {
    content += `near equilibrium ($${zones.equilibrium.toFixed(2)}). `;
  }
  
  content += `The ${trend === "bullish" ? "bullish" : trend === "bearish" ? "bearish" : "neutral"} market structure `;
  
  if (structure.bos.length > 0) {
    const lastBOS = structure.bos[structure.bos.length - 1];
    content += `is reinforced by a ${lastBOS.direction} BOS at $${lastBOS.price.toFixed(2)}. `;
  }
  
  if (structure.choch.length > 0) {
    const lastCHoCH = structure.choch[structure.choch.length - 1];
    content += `A ${lastCHoCH.direction} CHoCH at $${lastCHoCH.price.toFixed(2)} signals a potential trend change. `;
  }
  
  return {
    title: "Current Price Action",
    content: content.trim(),
  };
}

/**
 * Generate M15 breakdown
 */
function generateM15Breakdown(
  direction: "buy" | "sell",
  structure: TradeIdea["structure"],
  fvgs: TradeIdea["fvgs"],
  liquidity: TradeIdea["liquidity"],
  zones: TradeIdea["zones"]
): AnalysisReport["m15Breakdown"] {
  const items: string[] = [];
  
  // Structure on M15
  items.push(`M15 Structure: ${structure.trend.charAt(0).toUpperCase() + structure.trend.slice(1)} (${structure.higherHighs.length}HH, ${structure.higherLows.length}HL, ${structure.lowerHighs.length}LH, ${structure.lowerLows.length}LL)`);
  
  // Unmitigated FVGs
  const unmitigatedBullish = fvgs.filter(f => f.type === "bullish" && !f.mitigated).length;
  const unmitigatedBearish = fvgs.filter(f => f.type === "bearish" && !f.mitigated).length;
  
  if (unmitigatedBullish > 0) {
    items.push(`${unmitigatedBullish} unmitigated bullish FVG${unmitigatedBullish > 1 ? "s" : ""} available for long entries`);
  }
  if (unmitigatedBearish > 0) {
    items.push(`${unmitigatedBearish} unmitigated bearish FVG${unmitigatedBearish > 1 ? "s" : ""} available for short entries`);
  }
  
  // Key liquidity levels
  const buySide = liquidity.filter(l => l.type === "buy-side" && !l.tested).length;
  const sellSide = liquidity.filter(l => l.type === "sell-side" && !l.tested).length;
  
  if (buySide > 0) items.push(`${buySide} untested buy-side liquidity pool${buySide > 1 ? "s" : ""} above`);
  if (sellSide > 0) items.push(`${sellSide} untested sell-side liquidity pool${sellSide > 1 ? "s" : ""} below`);
  
  // Premium/Discount context
  items.push(`Range: $${zones.rangeHigh.toFixed(2)} - $${zones.rangeLow.toFixed(2)} | Equilibrium: $${zones.equilibrium.toFixed(2)}`);
  
  return {
    title: "M15 Breakdown",
    items,
  };
}

/**
 * Generate liquidity levels section
 */
function generateLiquidityLevelsSection(
  liquidity: TradeIdea["liquidity"],
  currentPrice: number
): AnalysisReport["liquidityLevels"] {
  const buySide = liquidity
    .filter(l => l.type === "buy-side")
    .sort((a, b) => a.price - b.price)
    .map(l => `$${l.price.toFixed(2)} (${l.source}${l.session ? ` - ${l.session}` : ""})${l.tested ? " ✓ tested" : ""}`);
  
  const sellSide = liquidity
    .filter(l => l.type === "sell-side")
    .sort((a, b) => b.price - a.price)
    .map(l => `$${l.price.toFixed(2)} (${l.source}${l.session ? ` - ${l.session}` : ""})${l.tested ? " ✓ tested" : ""}`);
  
  return { buySide, sellSide };
}

/**
 * Generate what to watch section
 */
function generateWhatToWatch(
  direction: "buy" | "sell",
  entry: number,
  stopLoss: number,
  takeProfit1: number,
  takeProfit2: number,
  liquidity: TradeIdea["liquidity"],
  zones: TradeIdea["zones"]
): AnalysisReport["whatToWatch"] {
  const invalidationLevel = stopLoss;
  
  // Find next liquidity draw target
  let liquidityDraw = direction === "buy" ? takeProfit2 : takeProfit2;
  
  if (direction === "buy") {
    const buySide = liquidity.filter(l => l.type === "buy-side" && l.price > takeProfit1);
    if (buySide.length > 0) {
      liquidityDraw = buySide[0].price;
    }
  } else {
    const sellSide = liquidity.filter(l => l.type === "sell-side" && l.price < takeProfit1);
    if (sellSide.length > 0) {
      liquidityDraw = sellSide[0].price;
    }
  }
  
  let note = "";
  if (direction === "buy") {
    note = `Invalidation below $${invalidationLevel.toFixed(2)} (structure break). ` +
      `Liquidity draw toward $${liquidityDraw.toFixed(2)}. ` +
      `Watch for rejection at unmitigated bearish FVGs above entry.`;
  } else {
    note = `Invalidation above $${invalidationLevel.toFixed(2)} (structure break). ` +
      `Liquidity draw toward $${liquidityDraw.toFixed(2)}. ` +
      `Watch for rejection at unmitigated bullish FVGs below entry.`;
  }
  
  return {
    invalidationLevel,
    liquidityDraw,
    note,
  };
}

/**
 * Generate "Why This Trade" section with top reasons
 */
function generateWhyThisTrade(trade: TradeIdea): WhyThisTrade[] {
  // Sort reasons by weight descending
  const sortedReasons = [...trade.reasons].sort((a, b) => b.weight - a.weight);
  
  // Take top 5 reasons
  const topReasons = sortedReasons.slice(0, 5);
  
  return topReasons.map((reason, index) => {
    // Get a phrasing variant
    const variants = defaultPhrasingVariants[reason.label];
    let phrasing = "";
    
    if (variants && variants[reason.direction as keyof typeof variants]) {
      const directionVariants = variants[reason.direction as keyof typeof variants];
      if (directionVariants.length > 0) {
        // Pick a variant based on index for variety
        phrasing = directionVariants[index % directionVariants.length];
      }
    }
    
    // Fallback to generic phrasing
    if (!phrasing) {
      phrasing = `${reason.label}: ${reason.value}`;
    }
    
    return {
      reason: phrasing,
      weight: reason.weight,
      category: reason.category,
      variant: phrasing,
    };
  });
}

/**
 * Generate simple summary for 8-year-old
 */
function generateSimpleSummary(trade: TradeIdea): SimpleSummary {
  const { direction, entry, stopLoss, takeProfit1, takeProfit2, confidence } = trade;
  
  const templates = direction === "buy" ? analogyTemplates.bullish : 
                    direction === "sell" ? analogyTemplates.bearish : 
                    analogyTemplates.neutral;
  
  // Pick a template (could be based on confidence or random)
  const templateIndex = Math.floor(confidence / 33) % templates.length;
  const template = templates[templateIndex];
  
  const sentence = template
    .replace("{entry}", `$${entry.toFixed(2)}`)
    .replace("{sl}", `$${stopLoss.toFixed(2)}`)
    .replace("{tp1}", `$${takeProfit1.toFixed(2)}`)
    .replace("{tp2}", `$${takeProfit2.toFixed(2)}`);
  
  // Add confidence context
  const confidenceText = confidence >= 70 ? "We're quite confident." : 
                         confidence >= 50 ? "We're moderately confident." : 
                         "We're not very confident, so trade small.";
  
  return {
    sentences: [
      sentence,
      `We risk $${Math.abs(entry - stopLoss).toFixed(2)} per ounce to make $${Math.abs(takeProfit1 - entry).toFixed(2)} (first target) or $${Math.abs(takeProfit2 - entry).toFixed(2)} (second target).`,
      confidenceText,
    ],
  };
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}