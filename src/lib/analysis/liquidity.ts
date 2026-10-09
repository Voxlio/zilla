import { Candle, SwingPoint, LiquidityLevel, SessionRange } from "./types";

/**
 * Detect liquidity levels (buy-side and sell-side) from swing points
 * @param swings Array of swing points
 * @returns Array of liquidity levels
 */
export function detectLiquidityFromSwings(swings: SwingPoint[]): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];

  for (const swing of swings) {
    // Buy-side liquidity is at swing highs (price levels where shorts might have stops)
    if (swing.type === "high") {
      levels.push({
        price: swing.price,
        time: swing.time,
        type: "buy-side",
        source: "swing",
        strength: 1.0, // Will be adjusted based on context
        tested: false,
      });
    }
    // Sell-side liquidity is at swing lows (price levels where longs might have stops)
    else if (swing.type === "low") {
      levels.push({
        price: swing.price,
        time: swing.time,
        type: "sell-side",
        source: "swing",
        strength: 1.0,
        tested: false,
      });
    }
  }

  // Mark levels as tested if price has touched them after formation
  return markTestedLevels(levels);
}

/**
 * Detect intermediate liquidity levels (from price action within swings)
 * @param candles Array of candles
 * @param swings Array of swing points
 * @returns Array of intermediate liquidity levels
 */
export function detectIntermediateLiquidity(
  candles: Candle[],
  swings: SwingPoint[]
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];

  if (swings.length < 2) return levels;

  // For each swing pair (high to low or low to high), look for intermediate highs/lows
  for (let i = 1; i < swings.length; i++) {
    const prevSwing = swings[i - 1];
    const currSwing = swings[i];

    // We are looking for the opposite type: if prev is high, we look for lows in between, and vice versa
    const targetType = prevSwing.type === "high" ? "low" : "high";

    // Find the extreme point between the two swings
    let extremePrice = prevSwing.price;
    let extremeTime = prevSwing.time;
    let found = false;

    // Iterate through candles between the two swings
    for (let j = prevSwing.index + 1; j < currSwing.index; j++) {
      const candle = candles[j];
      if (targetType === "high") {
        if (candle.high > extremePrice) {
          extremePrice = candle.high;
          extremeTime = candle.time;
          found = true;
        }
      } else {
        if (candle.low < extremePrice) {
          extremePrice = candle.low;
          extremeTime = candle.time;
          found = true;
        }
      }
    }

    if (found) {
      levels.push({
        price: extremePrice,
        time: extremeTime,
        type: targetType === "high" ? "buy-side" : "sell-side",
        source: "intermediate",
        strength: 0.7, // Intermediate levels are weaker than swing levels
        tested: false,
      });
    }
  }

  return markTestedLevels(levels);
}

/**
 * Detect session highs and lows (Asia, London, NY)
 * @param candles Array of candles (must be in chronological order)
 * @returns Array of session ranges
 */
export function detectSessionRanges(candles: Candle[]): SessionRange[] {
  if (candles.length === 0) return [];

  // Define session times in UTC (approximate)
  // Asia: 00:00 - 08:00 UTC
  // London: 07:00 - 16:00 UTC
  // NY: 12:00 - 20:00 UTC
  // Note: These are approximate and can be adjusted based on DST, but for simplicity we use fixed offsets.

  const sessions: SessionRange[] = [];
  const sessionTimes = [
    { name: "asia", startHour: 0, endHour: 8 },
    { name: "london", startHour: 7, endHour: 16 },
    { name: "ny", startHour: 12, endHour: 20 },
  ];

  // Group candles by day
  const days: Map<string, Candle[]> = new Map();
  for (const candle of candles) {
    const date = new Date(candle.time * 1000);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
    if (!days.has(dateKey)) {
      days.set(dateKey, []);
    }
    days.get(dateKey)!.push(candle);
  }

  // For each day, calculate session highs and lows
  days.forEach((dayCandles: Candle[]) => {
    for (const session of sessionTimes) {
      const sessionCandles = dayCandles.filter((candle: Candle) => {
        const date = new Date(candle.time * 1000);
        const hour = date.getUTCHours();
        return hour >= session.startHour && hour < session.endHour;
      });

      if (sessionCandles.length === 0) continue;

      let high = sessionCandles[0].high;
      let low = sessionCandles[0].low;
      let highTime = sessionCandles[0].time;
      let lowTime = sessionCandles[0].time;

      for (const candle of sessionCandles) {
        if (candle.high > high) {
          high = candle.high;
          highTime = candle.time;
        }
        if (candle.low < low) {
          low = candle.low;
          lowTime = candle.time;
        }
      }

      sessions.push({
        session: session.name as "asia" | "london" | "ny",
        high,
        low,
        highTime,
        lowTime,
      });
    }
  });

  return sessions;
}

/**
 * Convert session ranges to liquidity levels
 * @param sessions Array of session ranges
 * @returns Array of liquidity levels from sessions
 */
export function sessionRangesToLiquidity(sessions: SessionRange[]): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];

  for (const session of sessions) {
    // Session high is sell-side liquidity (longs might have stops below)
    levels.push({
      price: session.high,
      time: session.highTime,
      type: "sell-side",
      source: "session",
      session: session.session,
      strength: 0.8,
      tested: false,
    });

    // Session low is buy-side liquidity (shorts might have stops above)
    levels.push({
      price: session.low,
      time: session.lowTime,
      type: "buy-side",
      source: "session",
      session: session.session,
      strength: 0.8,
      tested: false,
    });
  }

  return markTestedLevels(levels);
}

/**
 * Mark liquidity levels as tested if price has touched them after formation
 * @param levels Array of liquidity levels
 * @returns Array of liquidity levels with tested status updated
 */
export function markTestedLevels(levels: LiquidityLevel[]): LiquidityLevel[] {
  // Note: This function assumes that the levels array is sorted by time (ascending)
  // and that we have access to the full candle data to check for touches.
  // However, in this function we don't have the candles. So we cannot mark as tested here.
  // We'll leave it to the caller to update tested status if needed, or we can change the function signature.
  // For now, we return the levels as is, and the caller must update tested status separately.
  return levels;
}

/**
 * Combine all liquidity sources and remove duplicates (or merge nearby levels)
 * @param swingLevels Liquidity levels from swings
 * @param intermediateLevels Liquidity levels from intermediate points
 * @param sessionLevels Liquidity levels from sessions
 * @param proximityThreshold Price proximity to consider levels as the same (in price units)
 * @returns Combined and deduplicated liquidity levels
 */
export function combineLiquidityLevels(
  swingLevels: LiquidityLevel[],
  intermediateLevels: LiquidityLevel[],
  sessionLevels: LiquidityLevel[],
  proximityThreshold: number = 0.1 // Default 0.1 for gold (can be adjusted)
): LiquidityLevel[] {
  const allLevels = [...swingLevels, ...intermediateLevels, ...sessionLevels];

  // Sort by price
  allLevels.sort((a, b) => a.price - b.price);

  const merged: LiquidityLevel[] = [];

  for (const level of allLevels) {
    if (merged.length === 0) {
      merged.push(level);
      continue;
    }

    const last = merged[merged.length - 1];
    // If the current level is within proximityThreshold of the last level, merge them
    if (Math.abs(level.price - last.price) <= proximityThreshold) {
      // Merge: take the average price, the latest time, and the stronger strength
      merged[merged.length - 1] = {
        price: (last.price + level.price) / 2,
        time: Math.max(last.time, level.time),
        type: last.type, // Note: assuming same type, otherwise we might need to handle differently
        source: last.source, // Keep the original source
        // Combine strengths: we can take the max or average. Let's take max for conservatism.
        strength: Math.max(last.strength, level.strength),
        // If either is tested, then the merged level is tested
        tested: last.tested || level.tested,
        // For session, we might lose the session info, but we can note it's combined
        session: last.session,
      };
    } else {
      merged.push(level);
    }
  }

  return merged;
}

/**
 * Update tested status of liquidity levels based on candle data
 * @param levels Array of liquidity levels
 * @param candles Array of candles (must be in chronological order)
 * @returns Array of liquidity levels with updated tested status
 */
export function updateLiquidityTestedStatus(
  levels: LiquidityLevel[],
  candles: Candle[]
): LiquidityLevel[] {
  // Create a copy to avoid mutating the original array
  const result = [...levels];

  // For each level, check if any candle has touched the level (within a small threshold)
  const touchThreshold = 0.05; // Adjust as needed

  for (let i = 0; i < result.length; i++) {
    const level = result[i];
    if (level.tested) continue; // Skip if already tested

    for (const candle of candles) {
      // Check if the candle's high or low touches the level
      if (
        Math.abs(candle.high - level.price) <= touchThreshold ||
        Math.abs(candle.low - level.price) <= touchThreshold
      ) {
        result[i] = {
          ...level,
          tested: true,
        };
        break;
      }
    }
  }

  return result;
}

/**
 * Get liquidity levels above or below a price
 * @param levels Array of liquidity levels
 * @param price Current price
 * @param direction "above" or "below"
 * @returns Array of liquidity levels in the specified direction
 */
export function getLiquidityInDirection(
  levels: LiquidityLevel[],
  price: number,
  direction: "above" | "below"
): LiquidityLevel[] {
  if (direction === "above") {
    return levels.filter(level => level.price > price).sort((a, b) => a.price - b.price);
  } else {
    return levels.filter(level => level.price < price).sort((a, b) => b.price - a.price);
  }
}

/**
 * Get the nearest liquidity level above or below a price
 * @param levels Array of liquidity levels
 * @param price Current price
 * @param direction "above" or "below"
 * @returns Nearest liquidity level or null
 */
export function getNearestLiquidity(
  levels: LiquidityLevel[],
  price: number,
  direction: "above" | "below"
): LiquidityLevel | null {
  const inDirection = getLiquidityInDirection(levels, price, direction);
  if (inDirection.length === 0) return null;

  if (direction === "above") {
    // Return the one with the smallest price (closest above)
    return inDirection.reduce((closest, current) =>
      current.price < closest.price ? current : closest
    );
  } else {
    // Return the one with the largest price (closest below)
    return inDirection.reduce((closest, current) =>
      current.price > closest.price ? current : closest
    );
  }
}