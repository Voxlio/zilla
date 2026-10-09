import { 
  Candle, 
  TradeIdea, 
  TradeDirection, 
  Reason, 
  MarketStructure, 
  FVG, 
  LiquidityLevel, 
  PremiumDiscountZones,
  SessionRange,
  AssetConfig,
  FundamentalData
} from "./types";

/**
 * Build a trade idea based on analysis
 * @param params Analysis parameters
 * @returns TradeIdea object
 */
export function buildTradeIdea(params: {
  symbol: string;
  currentPrice: number;
  structure: MarketStructure;
  fvgs: FVG[];
  liquidity: LiquidityLevel[];
  sessions: SessionRange[];
  zones: PremiumDiscountZones;
  fundamentalData: FundamentalData;
  assetConfig: AssetConfig;
  reasons: Reason[];
}): TradeIdea {
  const { 
    symbol, 
    currentPrice, 
    structure, 
    fvgs, 
    liquidity, 
    sessions, 
    zones, 
    fundamentalData, 
    assetConfig, 
    reasons 
  } = params;

  // Determine direction based on combined technical and fundamental scores
  const technicalScore = calculateTechnicalScore(reasons);
  const fundamentalScore = fundamentalData.score;
  const combinedScore = (technicalScore * 0.7) + (fundamentalScore * 0.3);

  // Direction: if combined score is positive, bullish (buy); if negative, bearish (sell)
  // Never return "no trade" - always pick a side
  let direction: TradeDirection = combinedScore >= 0 ? "buy" : "sell";
  
  // If scores are very close to zero, lower confidence but still pick a direction
  const scoreMagnitude = Math.abs(combinedScore);
  const baseConfidence = Math.min(scoreMagnitude, 100);

  // Find entry point: reaction zone (unmitigated FVG in bias direction)
  let entry = findEntry(direction, currentPrice, fvgs, zones, structure);
  
  // Find stop loss: beyond invalidation level
  const stopLoss = findStopLoss(direction, entry, currentPrice, structure, zones, liquidity);
  
  // Find take profits: at next liquidity pools
  const { takeProfit1, takeProfit2 } = findTakeProfits(direction, entry, stopLoss, liquidity, zones);

  // Calculate risk-reward
  const risk = Math.abs(entry - stopLoss);
  const reward1 = Math.abs(takeProfit1 - entry);
  const riskReward = risk > 0 ? reward1 / risk : 1;

  // Calculate confidence based on weighted agreement of reasons
  const confidence = calculateConfidence(reasons, baseConfidence, riskReward);

  // Build the trade idea
  const tradeIdea: TradeIdea = {
    id: generateTradeId(),
    timestamp: Date.now(),
    symbol,
    direction,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward,
    confidence,
    reasons,
    technicalScore,
    fundamentalScore,
    currentPrice,
    structure,
    fvgs,
    liquidity,
    sessions,
    zones,
    disclaimer: "Educational only, not financial advice. Trading carries risk.",
  };

  return tradeIdea;
}

/**
 * Calculate technical score from reasons
 * @param reasons Array of reasons
 * @returns Technical score (-100 to +100)
 */
function calculateTechnicalScore(reasons: Reason[]): number {
  const technicalReasons = reasons.filter(r => 
    r.category === "structure" || r.category === "fvg" || r.category === "liquidity" || 
    r.category === "session" || r.category === "premium-discount"
  );
  
  let score = 0;
  let totalWeight = 0;
  
  for (const reason of technicalReasons) {
    const weight = reason.weight / 100;
    if (reason.direction === "bullish") {
      score += weight * 100;
    } else if (reason.direction === "bearish") {
      score -= weight * 100;
    }
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return 0;
  return Math.round((score / totalWeight) * 100) / 100;
}

/**
 * Calculate confidence based on weighted agreement of reasons
 * @param reasons Array of reasons
 * @param baseConfidence Base confidence from score magnitude
 * @param riskReward Risk-reward ratio
 * @returns Confidence percentage (0-100)
 */
function calculateConfidence(reasons: Reason[], baseConfidence: number, riskReward: number): number {
  if (reasons.length === 0) return 50; // Default minimum confidence

  // Weighted agreement
  let bullishWeight = 0;
  let bearishWeight = 0;
  let totalWeight = 0;

  for (const reason of reasons) {
    const weight = reason.weight;
    totalWeight += weight;
    if (reason.direction === "bullish") bullishWeight += weight;
    else if (reason.direction === "bearish") bearishWeight += weight;
  }

  // Agreement ratio: how much weight is on the dominant side
  const dominantWeight = Math.max(bullishWeight, bearishWeight);
  const agreementRatio = totalWeight > 0 ? dominantWeight / totalWeight : 0.5;

  // Risk-reward boost: higher RR increases confidence
  const rrBoost = Math.min(riskReward / 2, 1) * 15; // Max 15% boost

  // Combine base confidence, agreement, and RR boost
  let confidence = baseConfidence * agreementRatio + rrBoost;

  // Clamp to 0-100
  confidence = Math.max(30, Math.min(95, confidence)); // Minimum 30%, maximum 95%

  return Math.round(confidence);
}

/**
 * Find entry point based on direction and available zones
 * @param direction Trade direction
 * @param currentPrice Current price
 * @param fvgs Array of FVGs
 * @param zones Premium/discount zones
 * @param structure Market structure
 * @returns Entry price
 */
function findEntry(
  direction: TradeDirection,
  currentPrice: number,
  fvgs: FVG[],
  zones: PremiumDiscountZones,
  structure: MarketStructure
): number {
  const unmitigatedFVGs = fvgs.filter(fvg => !fvg.mitigated);

  if (direction === "buy") {
    // For buy: look for bullish unmitigated FVG in discount zone
    const bullishFVGs = unmitigatedFVGs.filter(fvg => fvg.type === "bullish");
    const discountFVGs = bullishFVGs.filter(fvg => fvg.top < zones.equilibrium && fvg.top > zones.rangeLow);
    
    if (discountFVGs.length > 0) {
      // Return the bottom of the nearest FVG (entry at the gap)
      const nearest = discountFVGs.reduce((closest, current) => 
        current.bottom > closest.bottom ? current : closest
      );
      return nearest.bottom;
    }
    
    // Fallback: enter at discount zone top or equilibrium
    return zones.discount.top;
  } else {
    // For sell: look for bearish unmitigated FVG in premium zone
    const bearishFVGs = unmitigatedFVGs.filter(fvg => fvg.type === "bearish");
    const premiumFVGs = bearishFVGs.filter(fvg => fvg.bottom > zones.equilibrium && fvg.bottom < zones.rangeHigh);
    
    if (premiumFVGs.length > 0) {
      // Return the top of the nearest FVG (entry at the gap)
      const nearest = premiumFVGs.reduce((closest, current) => 
        current.top < closest.top ? current : closest
      );
      return nearest.top;
    }
    
    // Fallback: enter at premium zone bottom or equilibrium
    return zones.premium.bottom;
  }
}

/**
 * Find stop loss level
 * @param direction Trade direction
 * @param entry Entry price
 * @param currentPrice Current price
 * @param structure Market structure
 * @param zones Premium/discount zones
 * @param liquidity Liquidity levels
 * @returns Stop loss price
 */
function findStopLoss(
  direction: TradeDirection,
  entry: number,
  currentPrice: number,
  structure: MarketStructure,
  zones: PremiumDiscountZones,
  liquidity: LiquidityLevel[]
): number {
  if (direction === "buy") {
    // SL below the nearest swing low or session low, or below the discount zone
    const sellSideLiquidity = liquidity.filter(l => l.type === "sell-side" && l.price < entry);
    if (sellSideLiquidity.length > 0) {
      // Use the nearest sell-side liquidity below entry
      const nearest = sellSideLiquidity.reduce((closest, current) => 
        current.price > closest.price ? current : closest
      );
      // Place SL just beyond the liquidity level (add a small buffer)
      return nearest.price - 0.20; // 20 cents buffer for gold
    }
    
    // Fallback: use range low with buffer
    return zones.rangeLow - 0.50;
  } else {
    // SL above the nearest swing high or session high, or above the premium zone
    const buySideLiquidity = liquidity.filter(l => l.type === "buy-side" && l.price > entry);
    if (buySideLiquidity.length > 0) {
      // Use the nearest buy-side liquidity above entry
      const nearest = buySideLiquidity.reduce((closest, current) => 
        current.price < closest.price ? current : closest
      );
      // Place SL just beyond the liquidity level
      return nearest.price + 0.20; // 20 cents buffer
    }
    
    // Fallback: use range high with buffer
    return zones.rangeHigh + 0.50;
  }
}

/**
 * Find take profit levels
 * @param direction Trade direction
 * @param entry Entry price
 * @param stopLoss Stop loss price
 * @param liquidity Liquidity levels
 * @param zones Premium/discount zones
 * @returns Object with takeProfit1 and takeProfit2
 */
function findTakeProfits(
  direction: TradeDirection,
  entry: number,
  stopLoss: number,
  liquidity: LiquidityLevel[],
  zones: PremiumDiscountZones
): { takeProfit1: number; takeProfit2: number } {
  const risk = Math.abs(entry - stopLoss);
  
  if (direction === "buy") {
    // TP1: First buy-side liquidity above entry
    const buySide = liquidity.filter(l => l.type === "buy-side" && l.price > entry)
      .sort((a, b) => a.price - b.price);
    
    let takeProfit1: number;
    let takeProfit2: number;
    
    if (buySide.length > 0) {
      takeProfit1 = buySide[0].price;
    } else {
      // Minimum 1:2 RR
      takeProfit1 = entry + risk * 2;
    }
    
    // TP2: Second buy-side liquidity or 1:3 RR
    if (buySide.length > 1) {
      takeProfit2 = buySide[1].price;
    } else if (buySide.length === 1) {
      takeProfit2 = entry + risk * 3;
    } else {
      takeProfit2 = entry + risk * 3;
    }
    
    // Ensure TP2 is further than TP1
    if (takeProfit2 <= takeProfit1) {
      takeProfit2 = takeProfit1 + risk;
    }
    
    return { takeProfit1, takeProfit2 };
  } else {
    // TP1: First sell-side liquidity below entry
    const sellSide = liquidity.filter(l => l.type === "sell-side" && l.price < entry)
      .sort((a, b) => b.price - a.price);
    
    let takeProfit1: number;
    let takeProfit2: number;
    
    if (sellSide.length > 0) {
      takeProfit1 = sellSide[0].price;
    } else {
      // Minimum 1:2 RR
      takeProfit1 = entry - risk * 2;
    }
    
    // TP2: Second sell-side liquidity or 1:3 RR
    if (sellSide.length > 1) {
      takeProfit2 = sellSide[1].price;
    } else if (sellSide.length === 1) {
      takeProfit2 = entry - risk * 3;
    } else {
      takeProfit2 = entry - risk * 3;
    }
    
    // Ensure TP2 is further than TP1
    if (takeProfit2 >= takeProfit1) {
      takeProfit2 = takeProfit1 - risk;
    }
    
    return { takeProfit1, takeProfit2 };
  }
}

/**
 * Generate a unique trade ID
 * @returns Unique trade ID string
 */
function generateTradeId(): string {
  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Round price to appropriate precision for the asset
 * @param price Price to round
 * @param pipSize Pip size (e.g., 0.01 for gold)
 * @returns Rounded price
 */
export function roundPrice(price: number, pipSize: number = 0.01): number {
  return Math.round(price / pipSize) * pipSize;
}