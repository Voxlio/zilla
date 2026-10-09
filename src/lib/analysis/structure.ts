import { Candle, SwingPoint, MarketStructure, BreakOfStructure, ChangeOfCharacter } from "./types";

/**
 * Detect swing points (pivot highs and lows) in candle data
 * @param candles Array of candles
 * @param lookback Period to look back for pivot confirmation (default: 2)
 * @returns Array of swing points
 */
export function detectSwingPoints(candles: Candle[], lookback: number = 2): SwingPoint[] {
  if (candles.length < lookback * 2 + 1) {
    return [];
  }

  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const candle = candles[i];
    let isHigh = true;
    let isLow = true;

    // Check if current candle is a pivot high
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candle.high) {
        isHigh = false;
      }
      if (candles[j].low <= candle.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      swings.push({
        index: i,
        time: candle.time,
        price: candle.high,
        type: "high",
      });
    }

    if (isLow) {
      swings.push({
        index: i,
        time: candle.time,
        price: candle.low,
        type: "low",
      });
    }
  }

  // Sort by index to maintain order
  swings.sort((a, b) => a.index - b.index);

  return swings;
}

/**
 * Detect market structure including trend, BOS, and CHoCH
 * @param candles Array of candles
 * @param swings Array of swing points (from detectSwingPoints)
 * @returns MarketStructure object
 */
export function detectMarketStructure(
  candles: Candle[],
  swings: SwingPoint[]
): MarketStructure {
  if (swings.length < 2) {
    return {
      swings,
      trend: "ranging",
      bos: [],
      choch: [],
      higherHighs: [],
      higherLows: [],
      lowerHighs: [],
      lowerLows: [],
    };
  }

  const bos: BreakOfStructure[] = [];
  const choch: ChangeOfCharacter[] = [];
  const higherHighs: number[] = [];
  const higherLows: number[] = [];
  const lowerHighs: number[] = [];
  const lowerLows: number[] = [];

  // Determine initial trend from first two swings
  let trend: "bullish" | "bearish" | "ranging" = "ranging";
  if (swings[1].type === "high" && swings[0].type === "low") {
    // Low then High -> potential start of uptrend
    trend = "bullish";
  } else if (swings[1].type === "low" && swings[0].type === "high") {
    // High then Low -> potential start of downtrend
    trend = "bearish";
  }

  // Iterate through swings to detect BOS and CHoCH
  for (let i = 2; i < swings.length; i++) {
    const current = swings[i];
    const prev1 = swings[i - 1];
    const prev2 = swings[i - 2];

    // We need three swings to analyze structure
    if (!prev2) continue;

    // Check for Bullish BOS: current high breaks previous high in an uptrend
    if (
      current.type === "high" &&
      prev1.type === "low" &&
      prev2.type === "high" &&
      current.price > prev2.price
    ) {
      bos.push({
        index: current.index,
        time: current.time,
        price: current.price,
        direction: "bullish",
        type: "BOS",
      });
      // Update trend to bullish
      trend = "bullish";
      higherHighs.push(current.index);
    }

    // Check for Bearish BOS: current low breaks previous low in a downtrend
    if (
      current.type === "low" &&
      prev1.type === "high" &&
      prev2.type === "low" &&
      current.price < prev2.price
    ) {
      bos.push({
        index: current.index,
        time: current.time,
        price: current.price,
        direction: "bearish",
        type: "BOS",
      });
      // Update trend to bearish
      trend = "bearish";
      lowerLows.push(current.index);
    }

    // Check for Bullish CHoCH: current high breaks previous low in a downtrend (trend change)
    if (
      current.type === "high" &&
      prev1.type === "low" &&
      prev2.type === "high" &&
      trend === "bearish" &&
      current.price > prev2.price
    ) {
      choch.push({
        index: current.index,
        time: current.time,
        price: current.price,
        direction: "bullish",
        type: "CHoCH",
      });
      // Update trend to bullish
      trend = "bullish";
    }

    // Check for Bearish CHoCH: current low breaks previous high in an uptrend (trend change)
    if (
      current.type === "low" &&
      prev1.type === "high" &&
      prev2.type === "low" &&
      trend === "bullish" &&
      current.price < prev2.price
    ) {
      choch.push({
        index: current.index,
        time: current.time,
        price: current.price,
        direction: "bearish",
        type: "CHoCH",
      });
      // Update trend to bearish
      trend = "bearish";
    }

    // Track higher highs and higher lows for uptrend
    if (
      current.type === "high" &&
      prev1.type === "low" &&
      prev2.type === "high" &&
      current.price > prev2.price
    ) {
      higherHighs.push(current.index);
    }
    if (
      current.type === "low" &&
      prev1.type === "high" &&
      prev2.type === "low" &&
      current.price > prev2.price
    ) {
      higherLows.push(current.index);
    }

    // Track lower highs and lower lows for downtrend
    if (
      current.type === "high" &&
      prev1.type === "low" &&
      prev2.type === "high" &&
      current.price < prev2.price
    ) {
      lowerHighs.push(current.index);
    }
    if (
      current.type === "low" &&
      prev1.type === "high" &&
      prev2.type === "low" &&
      current.price < prev2.price
    ) {
      lowerLows.push(current.index);
    }
  }

  return {
    swings,
    trend,
    bos,
    choch,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
  };
}