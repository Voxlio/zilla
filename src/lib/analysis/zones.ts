import { Candle, PremiumDiscountZones, MarketStructure, LiquidityLevel, FVG } from "./types";

/**
 * Calculate premium/discount zones from the current range
 * @param candles Array of candles
 * @param lookback Number of candles to look back for range determination (default: 50)
 * @returns PremiumDiscountZones object
 */
export function calculatePremiumDiscountZones(
  candles: Candle[],
  lookback: number = 50
): PremiumDiscountZones {
  if (candles.length < 2) {
    return {
      rangeHigh: 0,
      rangeLow: 0,
      premium: { top: 0, bottom: 0 },
      equilibrium: 0,
      discount: { top: 0, bottom: 0 },
    };
  }

  // Use the last 'lookback' candles to determine the range
  const relevantCandles = candles.slice(-lookback);

  let rangeHigh = relevantCandles[0].high;
  let rangeLow = relevantCandles[0].low;

  for (const candle of relevantCandles) {
    if (candle.high > rangeHigh) rangeHigh = candle.high;
    if (candle.low < rangeLow) rangeLow = candle.low;
  }

  const range = rangeHigh - rangeLow;
  const equilibrium = rangeLow + range / 2;

  return {
    rangeHigh,
    rangeLow,
    premium: {
      top: rangeHigh,
      bottom: equilibrium,
    },
    equilibrium,
    discount: {
      top: equilibrium,
      bottom: rangeLow,
    },
  };
}

/**
 * Determine if price is in premium, discount, or equilibrium
 * @param price Current price
 * @param zones PremiumDiscountZones object
 * @returns "premium" | "discount" | "equilibrium"
 */
export function getPriceZone(
  price: number,
  zones: PremiumDiscountZones
): "premium" | "discount" | "equilibrium" {
  if (price >= zones.equilibrium) {
    if (price > zones.premium.bottom) return "premium";
    return "equilibrium";
  } else {
    if (price < zones.discount.top) return "discount";
    return "equilibrium";
  }
}

/**
 * Calculate Fibonacci retracement levels from a range
 * @param high Range high
 * @param low Range low
 * @returns Object with fib levels
 */
export function calculateFibLevels(high: number, low: number) {
  const range = high - low;
  return {
    "0": high,
    "0.236": high - range * 0.236,
    "0.382": high - range * 0.382,
    "0.5": high - range * 0.5,
    "0.618": high - range * 0.618,
    "0.786": high - range * 0.786,
    "1": low,
  };
}

/**
 * Determine the bias direction based on market structure and price location
 * @param structure MarketStructure object
 * @param zones PremiumDiscountZones object
 * @param currentPrice Current price
 * @returns "bullish" | "bearish" | "ranging"
 */
export function determineBias(
  structure: MarketStructure,
  zones: PremiumDiscountZones,
  currentPrice: number
): "bullish" | "bearish" | "ranging" {
  // Primary bias from market structure
  let bias = structure.trend;

  // Adjust based on price location in premium/discount
  const priceZone = getPriceZone(currentPrice, zones);

  // If in discount, favor long bias (buy in discount)
  if (priceZone === "discount" && bias === "bearish") {
    bias = "ranging";
  } else if (priceZone === "premium" && bias === "bullish") {
    bias = "ranging";
  }

  return bias;
}